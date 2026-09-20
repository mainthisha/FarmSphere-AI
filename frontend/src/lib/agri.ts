// Rule-based + heuristic "AI" engine powering AgriTwin simulations, risk,
// profit and sustainability scoring. Pure functions, safe on client & server.

export type CropKey =
  | "Rice"
  | "Wheat"
  | "Sugarcane"
  | "Cotton"
  | "Groundnut"
  | "Maize"
  | "Tomato";

export interface CropProfile {
  key: CropKey;
  /** tonnes per acre in ideal conditions */
  baseYield: number;
  /** market price per tonne (INR) */
  price: number;
  /** ideal seasonal rainfall in mm */
  idealRain: number;
  /** ideal average temperature in °C */
  idealTemp: number;
  /** recommended fertilizer kg/acre */
  idealFertilizer: number;
  /** water demand index 0-1 */
  waterDemand: number;
  seedCost: number;
  fertilizerCost: number;
  labourCost: number;
}

export const CROPS: Record<CropKey, CropProfile> = {
  Rice: {
    key: "Rice",
    baseYield: 2.4,
    price: 21000,
    idealRain: 1100,
    idealTemp: 28,
    idealFertilizer: 110,
    waterDemand: 0.95,
    seedCost: 2500,
    fertilizerCost: 6500,
    labourCost: 12000,
  },
  Wheat: {
    key: "Wheat",
    baseYield: 1.9,
    price: 24000,
    idealRain: 550,
    idealTemp: 22,
    idealFertilizer: 90,
    waterDemand: 0.55,
    seedCost: 2200,
    fertilizerCost: 5200,
    labourCost: 9000,
  },
  Sugarcane: {
    key: "Sugarcane",
    baseYield: 32,
    price: 3200,
    idealRain: 1300,
    idealTemp: 30,
    idealFertilizer: 150,
    waterDemand: 1,
    seedCost: 9000,
    fertilizerCost: 11000,
    labourCost: 21000,
  },
  Cotton: {
    key: "Cotton",
    baseYield: 0.9,
    price: 62000,
    idealRain: 750,
    idealTemp: 29,
    idealFertilizer: 100,
    waterDemand: 0.6,
    seedCost: 4200,
    fertilizerCost: 7800,
    labourCost: 15000,
  },
  Groundnut: {
    key: "Groundnut",
    baseYield: 1.1,
    price: 55000,
    idealRain: 650,
    idealTemp: 27,
    idealFertilizer: 70,
    waterDemand: 0.45,
    seedCost: 5200,
    fertilizerCost: 4300,
    labourCost: 10000,
  },
  Maize: {
    key: "Maize",
    baseYield: 2.6,
    price: 19500,
    idealRain: 700,
    idealTemp: 26,
    idealFertilizer: 95,
    waterDemand: 0.55,
    seedCost: 2600,
    fertilizerCost: 5600,
    labourCost: 8800,
  },
  Tomato: {
    key: "Tomato",
    baseYield: 12,
    price: 14000,
    idealRain: 600,
    idealTemp: 25,
    idealFertilizer: 120,
    waterDemand: 0.7,
    seedCost: 6800,
    fertilizerCost: 9200,
    labourCost: 24000,
  },
};

export const CROP_LIST = Object.keys(CROPS) as CropKey[];

export const SOIL_TYPES = ["Loamy", "Clay", "Sandy", "Black", "Red", "Alluvial"] as const;

export interface SimulationInput {
  crop: CropKey;
  farmSize: number;
  rainfall: number;
  temperature: number;
  /** irrigation coverage 0-100 */
  irrigation: number;
  /** fertilizer kg/acre */
  fertilizer: number;
  /** soil quality 0-100 */
  soilQuality: number;
  /** pest control effectiveness 0-100 */
  pestControl: number;
  /** market price per tonne */
  marketPrice?: number;
}

export interface SimulationResult {
  yieldPerAcre: number;
  totalYield: number;
  revenue: number;
  investment: number;
  profit: number;
  waterUsage: number;
  riskScore: number;
  riskLabel: "Low" | "Moderate" | "High" | "Severe";
  droughtRisk: number;
  floodRisk: number;
  heatStress: number;
  pestRisk: number;
  sustainabilityScore: number;
  sustainability: SustainabilityBreakdown;
  recommendations: string[];
  factors: { name: string; value: number }[];
}

export interface SustainabilityBreakdown {
  waterEfficiency: number;
  fertilizerUsage: number;
  soilHealth: number;
  carbonReduction: number;
  score: number;
  grade: "A+" | "A" | "B" | "C" | "D";
  suggestions: string[];
}

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
const round = (v: number, d = 0) => Number(v.toFixed(d));

/** Bell-shaped response: 1 when actual == ideal, decays with distance. */
function response(actual: number, ideal: number, tolerance: number) {
  const diff = (actual - ideal) / tolerance;
  return Math.exp(-0.5 * diff * diff);
}

export function computeSustainability(input: SimulationInput): SustainabilityBreakdown {
  const crop = CROPS[input.crop];
  const effectiveWater = input.rainfall + input.irrigation * 6;
  const waterNeed = crop.idealRain * crop.waterDemand;
  const overWater = Math.max(0, effectiveWater - waterNeed) / waterNeed;
  const underWater = Math.max(0, waterNeed - effectiveWater) / waterNeed;
  const waterEfficiency = clamp(100 - overWater * 90 - underWater * 55);

  const fertRatio = input.fertilizer / crop.idealFertilizer;
  const fertilizerUsage = clamp(100 - Math.max(0, fertRatio - 1) * 130 - Math.max(0, 0.6 - fertRatio) * 60);

  const soilHealth = clamp(input.soilQuality * 0.75 + (100 - Math.abs(fertRatio - 1) * 60) * 0.25);

  const carbonReduction = clamp(
    100 - crop.waterDemand * 25 - Math.max(0, fertRatio - 1) * 60 - (100 - input.soilQuality) * 0.35,
  );

  const score = round(
    waterEfficiency * 0.3 + fertilizerUsage * 0.25 + soilHealth * 0.25 + carbonReduction * 0.2,
  );

  const grade: SustainabilityBreakdown["grade"] =
    score >= 90 ? "A+" : score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D";

  const suggestions: string[] = [];
  if (waterEfficiency < 75)
    suggestions.push(
      overWater > underWater
        ? "Switch to drip irrigation and irrigate at dawn — you are applying ~" +
            Math.round(overWater * 100) +
            "% more water than this crop needs."
        : "Water supply is short. Add supplementary irrigation or mulch the beds to cut evaporation.",
    );
  if (fertilizerUsage < 75)
    suggestions.push(
      fertRatio > 1
        ? "Reduce chemical fertilizer to about " +
            Math.round(CROPS[input.crop].idealFertilizer) +
            " kg/acre and split it into 3 doses to stop nutrient runoff."
        : "Nutrition is below the crop requirement — top up with compost or a balanced NPK dose.",
    );
  if (soilHealth < 75)
    suggestions.push("Improve soil health with green manure, crop rotation and 2 t/acre farmyard manure.");
  if (carbonReduction < 75)
    suggestions.push("Cut emissions with zero-tillage, solar pumping and biofertilizers in place of urea.");
  if (suggestions.length === 0)
    suggestions.push("Excellent practices — maintain rotation records to qualify for carbon-credit programmes.");

  return {
    waterEfficiency: round(waterEfficiency),
    fertilizerUsage: round(fertilizerUsage),
    soilHealth: round(soilHealth),
    carbonReduction: round(carbonReduction),
    score,
    grade,
    suggestions,
  };
}

export function simulate(input: SimulationInput): SimulationResult {
  const crop = CROPS[input.crop];
  const price = input.marketPrice ?? crop.price;

  const effectiveWater = input.rainfall + input.irrigation * 6;
  const waterFactor = response(effectiveWater, crop.idealRain * crop.waterDemand, crop.idealRain * 0.45);
  const tempFactor = response(input.temperature, crop.idealTemp, 6.5);
  const fertRatio = input.fertilizer / crop.idealFertilizer;
  const fertFactor = fertRatio <= 1 ? 0.55 + 0.45 * fertRatio : Math.max(0.55, 1 - (fertRatio - 1) * 0.45);
  const soilFactor = 0.5 + (input.soilQuality / 100) * 0.5;
  const pestFactor = 0.6 + (input.pestControl / 100) * 0.4;

  const yieldPerAcre = crop.baseYield * waterFactor * tempFactor * fertFactor * soilFactor * pestFactor;
  const totalYield = yieldPerAcre * input.farmSize;
  const revenue = totalYield * price;

  const investment =
    (crop.seedCost +
      crop.fertilizerCost * (input.fertilizer / crop.idealFertilizer) +
      crop.labourCost +
      input.irrigation * 25 +
      input.pestControl * 12) *
    input.farmSize;

  const droughtRisk = clamp(100 - (effectiveWater / (crop.idealRain * crop.waterDemand)) * 100);
  const floodRisk = clamp(((input.rainfall - crop.idealRain * 1.25) / (crop.idealRain * 0.6)) * 100);
  const heatStress = clamp(((input.temperature - (crop.idealTemp + 3)) / 10) * 100);
  const pestRisk = clamp(100 - input.pestControl * 0.85 - input.soilQuality * 0.1);

  const riskScore = round(droughtRisk * 0.34 + floodRisk * 0.26 + heatStress * 0.24 + pestRisk * 0.16);
  const riskLabel: SimulationResult["riskLabel"] =
    riskScore >= 70 ? "Severe" : riskScore >= 50 ? "High" : riskScore >= 30 ? "Moderate" : "Low";

  const sustainability = computeSustainability(input);

  const recommendations: string[] = [];
  if (droughtRisk > 45)
    recommendations.push("Increase irrigation frequency and mulch the field — drought stress is limiting yield.");
  if (floodRisk > 40)
    recommendations.push("Open drainage channels and raise bunds; excess rainfall may waterlog the root zone.");
  if (heatStress > 40)
    recommendations.push("Heat stress detected: irrigate in the early morning and consider shade netting for nurseries.");
  if (pestRisk > 45)
    recommendations.push("Deploy pheromone traps and neem-based sprays; pest pressure is high this cycle.");
  if (fertRatio > 1.2)
    recommendations.push("Fertilizer is over-applied — cut back to protect margins and groundwater.");
  if (fertRatio < 0.7) recommendations.push("Nutrient supply is low; a split urea/NPK dose can lift yield ~12%.");
  if (input.soilQuality < 55)
    recommendations.push("Soil quality is weak — add organic matter and test for pH before the next sowing.");
  if (recommendations.length === 0)
    recommendations.push("Conditions are near optimal for " + crop.key + ". Maintain the current plan.");

  // Always surface at least 4 tips so the dashboard never looks sparse —
  // top up with general best-practice guidance when few risk factors fire.
  const generalTips = [
    "Track daily field observations in a notebook or app — early trend spotting prevents bigger losses.",
    "Test soil pH and NPK levels once a season to fine-tune fertilizer instead of guessing.",
    "Rotate " + crop.key + " with a legume every 2–3 seasons to naturally rebuild soil nitrogen.",
    "Check your local mandi price trend weekly so harvest timing lines up with better rates.",
    "Keep 10–15% of the field as a buffer/border crop to slow pest movement into the main plot.",
  ];
  for (const tip of generalTips) {
    if (recommendations.length >= 4) break;
    if (!recommendations.includes(tip)) recommendations.push(tip);
  }

  return {
    yieldPerAcre: round(yieldPerAcre, 2),
    totalYield: round(totalYield, 2),
    revenue: Math.round(revenue),
    investment: Math.round(investment),
    profit: Math.round(revenue - investment),
    waterUsage: Math.round(effectiveWater * input.farmSize * 4.05),
    riskScore,
    riskLabel,
    droughtRisk: round(droughtRisk),
    floodRisk: round(floodRisk),
    heatStress: round(heatStress),
    pestRisk: round(pestRisk),
    sustainabilityScore: sustainability.score,
    sustainability,
    recommendations,
    factors: [
      { name: "Water", value: round(waterFactor * 100) },
      { name: "Temp", value: round(tempFactor * 100) },
      { name: "Nutrients", value: round(fertFactor * 100) },
      { name: "Soil", value: round(soilFactor * 100) },
      { name: "Pest control", value: round(pestFactor * 100) },
    ],
  };
}

export interface WeatherSnapshot {
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  condition: string;
  forecast: { day: string; temp: number; rain: number; humidity: number }[];
}

/** Deterministic pseudo weather derived from a location string + day of year. */
export function getWeather(location: string): WeatherSnapshot {
  const seedBase = Array.from(location || "farm").reduce((a, c) => a + c.charCodeAt(0), 0);
  const day = Math.floor(Date.now() / 86400000);
  const rnd = (n: number) => {
    const x = Math.sin(seedBase * 12.9898 + (day + n) * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const temperature = round(26 + rnd(1) * 10, 1);
  const humidity = Math.round(45 + rnd(2) * 45);
  const rainfall = round(rnd(3) * 28, 1);
  const windSpeed = round(4 + rnd(4) * 14, 1);
  const conditions = ["Sunny", "Partly cloudy", "Humid", "Light showers", "Overcast"];
  const condition = conditions[Math.floor(rnd(5) * conditions.length)];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = new Date().getDay();
  const forecast = Array.from({ length: 7 }, (_, i) => ({
    day: days[(today + i) % 7],
    temp: round(temperature + (rnd(10 + i) - 0.5) * 6, 1),
    rain: round(rnd(20 + i) * 32, 1),
    humidity: Math.round(clamp(humidity + (rnd(30 + i) - 0.5) * 25, 20, 98)),
  }));
  return { temperature, humidity, rainfall, windSpeed, condition, forecast };
}

export interface ClimateRisk {
  drought: number;
  flood: number;
  heat: number;
  score: number;
  label: "Low" | "Moderate" | "High" | "Severe";
  recommendations: string[];
}

export function climateRisk(weather: WeatherSnapshot, crop: CropKey): ClimateRisk {
  const profile = CROPS[crop];
  const seasonalRain = weather.forecast.reduce((a, f) => a + f.rain, 0) * 14;
  const drought = round(clamp(100 - (seasonalRain / (profile.idealRain * profile.waterDemand)) * 100));
  const flood = round(clamp(((seasonalRain - profile.idealRain * 1.2) / (profile.idealRain * 0.5)) * 100));
  const heat = round(clamp(((weather.temperature - (profile.idealTemp + 2)) / 9) * 100));
  const score = round(drought * 0.4 + flood * 0.3 + heat * 0.3);
  const label: ClimateRisk["label"] =
    score >= 70 ? "Severe" : score >= 50 ? "High" : score >= 30 ? "Moderate" : "Low";
  const recommendations: string[] = [];
  if (drought > 45) recommendations.push("Increase irrigation frequency to every 3 days and mulch exposed soil.");
  if (flood > 40) recommendations.push("Clear field drains now — heavy rain is expected within the week.");
  if (heat > 40) recommendations.push("Irrigate before 8 AM and apply potash spray to reduce heat stress.");
  if (weather.humidity > 80) recommendations.push("High humidity favours fungal blight — schedule a preventive spray.");
  if (recommendations.length === 0)
    recommendations.push("Climate conditions are favourable. Continue the normal irrigation schedule.");

  // Always surface at least 3 tips so the Climate Risk card never looks sparse.
  const generalTips = [
    "Check the 7-day forecast before planning irrigation, spraying or harvest days.",
    "Keep field drains and bunds clear year-round so sudden heavy rain doesn't cause damage.",
    "Mulch exposed soil to buffer both heat stress and moisture loss between rains.",
  ];
  for (const tip of generalTips) {
    if (recommendations.length >= 3) break;
    if (!recommendations.includes(tip)) recommendations.push(tip);
  }

  return { drought, flood, heat, score, label, recommendations };
}

export function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
