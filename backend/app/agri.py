"""Rule-based + heuristic AI engine powering FarmSphere AI's simulations,
risk, profit and sustainability scoring.

This is a faithful line-for-line port of the frontend's src/lib/agri.ts so
that server-side endpoints (e.g. /api/predict, /api/simulate) return results
identical to the client-side calculation used for instant slider feedback.
"""

import math
import time
from functools import reduce

CROPS = {
    "Rice": dict(baseYield=2.4, price=21000, idealRain=1100, idealTemp=28, idealFertilizer=110, waterDemand=0.95, seedCost=2500, fertilizerCost=6500, labourCost=12000),
    "Wheat": dict(baseYield=1.9, price=24000, idealRain=550, idealTemp=22, idealFertilizer=90, waterDemand=0.55, seedCost=2200, fertilizerCost=5200, labourCost=9000),
    "Sugarcane": dict(baseYield=32, price=3200, idealRain=1300, idealTemp=30, idealFertilizer=150, waterDemand=1, seedCost=9000, fertilizerCost=11000, labourCost=21000),
    "Cotton": dict(baseYield=0.9, price=62000, idealRain=750, idealTemp=29, idealFertilizer=100, waterDemand=0.6, seedCost=4200, fertilizerCost=7800, labourCost=15000),
    "Groundnut": dict(baseYield=1.1, price=55000, idealRain=650, idealTemp=27, idealFertilizer=70, waterDemand=0.45, seedCost=5200, fertilizerCost=4300, labourCost=10000),
    "Maize": dict(baseYield=2.6, price=19500, idealRain=700, idealTemp=26, idealFertilizer=95, waterDemand=0.55, seedCost=2600, fertilizerCost=5600, labourCost=8800),
    "Tomato": dict(baseYield=12, price=14000, idealRain=600, idealTemp=25, idealFertilizer=120, waterDemand=0.7, seedCost=6800, fertilizerCost=9200, labourCost=24000),
}

CROP_LIST = list(CROPS.keys())
SOIL_TYPES = ["Loamy", "Clay", "Sandy", "Black", "Red", "Alluvial"]


def clamp(v, lo=0, hi=100):
    return min(hi, max(lo, v))


def rnd(v, d=0):
    return round(v, d) if d else round(v)


def response(actual, ideal, tolerance):
    diff = (actual - ideal) / tolerance
    return math.exp(-0.5 * diff * diff)


def compute_sustainability(inp: dict) -> dict:
    crop = CROPS[inp["crop"]]
    effective_water = inp["rainfall"] + inp["irrigation"] * 6
    water_need = crop["idealRain"] * crop["waterDemand"]
    over_water = max(0, effective_water - water_need) / water_need
    under_water = max(0, water_need - effective_water) / water_need
    water_efficiency = clamp(100 - over_water * 90 - under_water * 55)

    fert_ratio = inp["fertilizer"] / crop["idealFertilizer"]
    fertilizer_usage = clamp(100 - max(0, fert_ratio - 1) * 130 - max(0, 0.6 - fert_ratio) * 60)

    soil_health = clamp(inp["soilQuality"] * 0.75 + (100 - abs(fert_ratio - 1) * 60) * 0.25)

    carbon_reduction = clamp(
        100 - crop["waterDemand"] * 25 - max(0, fert_ratio - 1) * 60 - (100 - inp["soilQuality"]) * 0.35
    )

    score = rnd(water_efficiency * 0.3 + fertilizer_usage * 0.25 + soil_health * 0.25 + carbon_reduction * 0.2)
    grade = "A+" if score >= 90 else "A" if score >= 80 else "B" if score >= 65 else "C" if score >= 50 else "D"

    suggestions = []
    if water_efficiency < 75:
        if over_water > under_water:
            suggestions.append(
                f"Switch to drip irrigation and irrigate at dawn — you are applying ~{round(over_water * 100)}% more water than this crop needs."
            )
        else:
            suggestions.append("Water supply is short. Add supplementary irrigation or mulch the beds to cut evaporation.")
    if fertilizer_usage < 75:
        if fert_ratio > 1:
            suggestions.append(
                f"Reduce chemical fertilizer to about {round(crop['idealFertilizer'])} kg/acre and split it into 3 doses to stop nutrient runoff."
            )
        else:
            suggestions.append("Nutrition is below the crop requirement — top up with compost or a balanced NPK dose.")
    if soil_health < 75:
        suggestions.append("Improve soil health with green manure, crop rotation and 2 t/acre farmyard manure.")
    if carbon_reduction < 75:
        suggestions.append("Cut emissions with zero-tillage, solar pumping and biofertilizers in place of urea.")
    if not suggestions:
        suggestions.append("Excellent practices — maintain rotation records to qualify for carbon-credit programmes.")

    return {
        "waterEfficiency": rnd(water_efficiency),
        "fertilizerUsage": rnd(fertilizer_usage),
        "soilHealth": rnd(soil_health),
        "carbonReduction": rnd(carbon_reduction),
        "score": score,
        "grade": grade,
        "suggestions": suggestions,
    }


def simulate(inp: dict) -> dict:
    crop = CROPS[inp["crop"]]
    price = inp.get("marketPrice") or crop["price"]

    effective_water = inp["rainfall"] + inp["irrigation"] * 6
    water_factor = response(effective_water, crop["idealRain"] * crop["waterDemand"], crop["idealRain"] * 0.45)
    temp_factor = response(inp["temperature"], crop["idealTemp"], 6.5)
    fert_ratio = inp["fertilizer"] / crop["idealFertilizer"]
    fert_factor = 0.55 + 0.45 * fert_ratio if fert_ratio <= 1 else max(0.55, 1 - (fert_ratio - 1) * 0.45)
    soil_factor = 0.5 + (inp["soilQuality"] / 100) * 0.5
    pest_factor = 0.6 + (inp["pestControl"] / 100) * 0.4

    yield_per_acre = crop["baseYield"] * water_factor * temp_factor * fert_factor * soil_factor * pest_factor
    total_yield = yield_per_acre * inp["farmSize"]
    revenue = total_yield * price

    investment = (
        crop["seedCost"]
        + crop["fertilizerCost"] * (inp["fertilizer"] / crop["idealFertilizer"])
        + crop["labourCost"]
        + inp["irrigation"] * 25
        + inp["pestControl"] * 12
    ) * inp["farmSize"]

    drought_risk = clamp(100 - (effective_water / (crop["idealRain"] * crop["waterDemand"])) * 100)
    flood_risk = clamp(((inp["rainfall"] - crop["idealRain"] * 1.25) / (crop["idealRain"] * 0.6)) * 100)
    heat_stress = clamp(((inp["temperature"] - (crop["idealTemp"] + 3)) / 10) * 100)
    pest_risk = clamp(100 - inp["pestControl"] * 0.85 - inp["soilQuality"] * 0.1)

    risk_score = rnd(drought_risk * 0.34 + flood_risk * 0.26 + heat_stress * 0.24 + pest_risk * 0.16)
    risk_label = "Severe" if risk_score >= 70 else "High" if risk_score >= 50 else "Moderate" if risk_score >= 30 else "Low"

    sustainability = compute_sustainability(inp)

    recommendations = []
    if drought_risk > 45:
        recommendations.append("Increase irrigation frequency and mulch the field — drought stress is limiting yield.")
    if flood_risk > 40:
        recommendations.append("Open drainage channels and raise bunds; excess rainfall may waterlog the root zone.")
    if heat_stress > 40:
        recommendations.append("Heat stress detected: irrigate in the early morning and consider shade netting for nurseries.")
    if pest_risk > 45:
        recommendations.append("Deploy pheromone traps and neem-based sprays; pest pressure is high this cycle.")
    if fert_ratio > 1.2:
        recommendations.append("Fertilizer is over-applied — cut back to protect margins and groundwater.")
    if fert_ratio < 0.7:
        recommendations.append("Nutrient supply is low; a split urea/NPK dose can lift yield ~12%.")
    if inp["soilQuality"] < 55:
        recommendations.append("Soil quality is weak — add organic matter and test for pH before the next sowing.")
    if not recommendations:
        recommendations.append(f"Conditions are near optimal for {inp['crop']}. Maintain the current plan.")

    general_tips = [
        "Track daily field observations in a notebook or app — early trend spotting prevents bigger losses.",
        "Test soil pH and NPK levels once a season to fine-tune fertilizer instead of guessing.",
        f"Rotate {inp['crop']} with a legume every 2–3 seasons to naturally rebuild soil nitrogen.",
        "Check your local mandi price trend weekly so harvest timing lines up with better rates.",
        "Keep 10–15% of the field as a buffer/border crop to slow pest movement into the main plot.",
    ]
    for tip in general_tips:
        if len(recommendations) >= 4:
            break
        if tip not in recommendations:
            recommendations.append(tip)

    return {
        "yieldPerAcre": rnd(yield_per_acre, 2),
        "totalYield": rnd(total_yield, 2),
        "revenue": round(revenue),
        "investment": round(investment),
        "profit": round(revenue - investment),
        "waterUsage": round(effective_water * inp["farmSize"] * 4.05),
        "riskScore": risk_score,
        "riskLabel": risk_label,
        "droughtRisk": rnd(drought_risk),
        "floodRisk": rnd(flood_risk),
        "heatStress": rnd(heat_stress),
        "pestRisk": rnd(pest_risk),
        "sustainabilityScore": sustainability["score"],
        "sustainability": sustainability,
        "recommendations": recommendations,
        "factors": [
            {"name": "Water", "value": rnd(water_factor * 100)},
            {"name": "Temp", "value": rnd(temp_factor * 100)},
            {"name": "Nutrients", "value": rnd(fert_factor * 100)},
            {"name": "Soil", "value": rnd(soil_factor * 100)},
            {"name": "Pest control", "value": rnd(pest_factor * 100)},
        ],
    }


def get_weather(location: str) -> dict:
    """Deterministic pseudo weather derived from a location string + day of year."""
    seed_base = reduce(lambda a, c: a + ord(c), location or "farm", 0)
    day = int(time.time() // 86400)

    def _rnd(n):
        x = math.sin(seed_base * 12.9898 + (day + n) * 78.233) * 43758.5453
        return x - math.floor(x)

    temperature = rnd(26 + _rnd(1) * 10, 1)
    humidity = round(45 + _rnd(2) * 45)
    rainfall = rnd(_rnd(3) * 28, 1)
    wind_speed = rnd(4 + _rnd(4) * 14, 1)
    conditions = ["Sunny", "Partly cloudy", "Humid", "Light showers", "Overcast"]
    condition = conditions[math.floor(_rnd(5) * len(conditions))]
    days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    today = time.localtime().tm_wday  # Mon=0..Sun=6 (Python) vs JS Sun=0..Sat=6
    today_js = (today + 1) % 7
    forecast = []
    for i in range(7):
        forecast.append(
            {
                "day": days[(today_js + i) % 7],
                "temp": rnd(temperature + (_rnd(10 + i) - 0.5) * 6, 1),
                "rain": rnd(_rnd(20 + i) * 32, 1),
                "humidity": round(clamp(humidity + (_rnd(30 + i) - 0.5) * 25, 20, 98)),
            }
        )
    return {
        "temperature": temperature,
        "humidity": humidity,
        "rainfall": rainfall,
        "windSpeed": wind_speed,
        "condition": condition,
        "forecast": forecast,
    }


def climate_risk(weather: dict, crop: str) -> dict:
    profile = CROPS[crop]
    seasonal_rain = sum(f["rain"] for f in weather["forecast"]) * 14
    drought = rnd(clamp(100 - (seasonal_rain / (profile["idealRain"] * profile["waterDemand"])) * 100))
    flood = rnd(clamp(((seasonal_rain - profile["idealRain"] * 1.2) / (profile["idealRain"] * 0.5)) * 100))
    heat = rnd(clamp(((weather["temperature"] - (profile["idealTemp"] + 2)) / 9) * 100))
    score = rnd(drought * 0.4 + flood * 0.3 + heat * 0.3)
    label = "Severe" if score >= 70 else "High" if score >= 50 else "Moderate" if score >= 30 else "Low"

    recommendations = []
    if drought > 45:
        recommendations.append("Increase irrigation frequency to every 3 days and mulch exposed soil.")
    if flood > 40:
        recommendations.append("Clear field drains now — heavy rain is expected within the week.")
    if heat > 40:
        recommendations.append("Irrigate before 8 AM and apply potash spray to reduce heat stress.")
    if weather["humidity"] > 80:
        recommendations.append("High humidity favours fungal blight — schedule a preventive spray.")
    if not recommendations:
        recommendations.append("Climate conditions are favourable. Continue the normal irrigation schedule.")

    general_tips = [
        "Check the 7-day forecast before planning irrigation, spraying or harvest days.",
        "Keep field drains and bunds clear year-round so sudden heavy rain doesn't cause damage.",
        "Mulch exposed soil to buffer both heat stress and moisture loss between rains.",
    ]
    for tip in general_tips:
        if len(recommendations) >= 3:
            break
        if tip not in recommendations:
            recommendations.append(tip)

    return {"drought": drought, "flood": flood, "heat": heat, "score": score, "label": label, "recommendations": recommendations}


def format_inr(value: float) -> str:
    return f"₹{round(value):,}"
