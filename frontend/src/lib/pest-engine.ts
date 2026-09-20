// AI-style pest outbreak prediction engine. Deterministic scoring model over
// crop, weather, season and growth stage. Pure functions.

import type { CropKey } from "@/lib/agri";
import type { RiskLevel } from "@/lib/disease-intel";

export const SEASONS = ["Kharif", "Rabi", "Summer"] as const;
export type Season = (typeof SEASONS)[number];

export const GROWTH_STAGES = ["Seedling", "Vegetative", "Flowering", "Maturity"] as const;
export type GrowthStage = (typeof GROWTH_STAGES)[number];

export interface PestInput {
  crop: CropKey;
  temperature: number;
  humidity: number;
  rainfall: number;
  season: Season;
  stage: GrowthStage;
}

interface PestProfile {
  name: string;
  crops: CropKey[];
  idealTemp: number;
  idealHumidity: number;
  idealRain: number;
  seasons: Season[];
  stages: GrowthStage[];
  windowDays: number;
  organic: string[];
  chemical: string[];
  monitoring: string[];
  emergency: string[];
}

export const PESTS: PestProfile[] = [
  {
    name: "Brown Planthopper",
    crops: ["Rice"],
    idealTemp: 30,
    idealHumidity: 82,
    idealRain: 45,
    seasons: ["Kharif", "Summer"],
    stages: ["Vegetative", "Flowering"],
    windowDays: 5,
    organic: ["Release Cyrtorhinus predators", "Neem oil spray 3% at base of tillers", "Drain the field for 3–4 days"],
    chemical: ["Pymetrozine 50 WG @ 120 g/acre", "Buprofezin 25 SC on hopper burn patches"],
    monitoring: ["Tap 10 hills per plot every morning", "Install 1 light trap per acre"],
    emergency: ["Spot-spray hopper burn patches within 24 hours", "Alert neighbouring plots"],
  },
  {
    name: "Yellow Stem Borer",
    crops: ["Rice", "Maize"],
    idealTemp: 28,
    idealHumidity: 75,
    idealRain: 30,
    seasons: ["Kharif", "Rabi"],
    stages: ["Vegetative", "Flowering"],
    windowDays: 7,
    organic: ["Trichogramma japonicum cards @ 5/acre", "Clip seedling tips before transplant"],
    chemical: ["Cartap hydrochloride 4G @ 8 kg/acre", "Chlorantraniliprole 0.4 GR"],
    monitoring: ["Count dead-hearts weekly", "Pheromone traps @ 8/acre"],
    emergency: ["Remove and burn white-ear tillers", "Avoid excess nitrogen immediately"],
  },
  {
    name: "Pink Bollworm",
    crops: ["Cotton"],
    idealTemp: 31,
    idealHumidity: 60,
    idealRain: 12,
    seasons: ["Kharif", "Summer"],
    stages: ["Flowering", "Maturity"],
    windowDays: 6,
    organic: ["Pheromone mass trapping @ 8 traps/acre", "NPV spray at dusk"],
    chemical: ["Thiodicarb 75 WP @ 400 g/acre", "Spinosad 45 SC on rosette flowers"],
    monitoring: ["Open 20 green bolls weekly", "Track rosette flower percentage"],
    emergency: ["Destroy infested bolls", "Terminate crop early if >10% boll damage"],
  },
  {
    name: "Fall Armyworm",
    crops: ["Maize", "Sugarcane"],
    idealTemp: 29,
    idealHumidity: 68,
    idealRain: 22,
    seasons: ["Kharif", "Rabi", "Summer"],
    stages: ["Seedling", "Vegetative"],
    windowDays: 4,
    organic: ["Sand + lime in whorls", "Bacillus thuringiensis spray", "Hand-pick egg masses"],
    chemical: ["Emamectin benzoate 5 SG @ 80 g/acre", "Spinetoram 11.7 SC whorl application"],
    monitoring: ["Scout 10 plants in 5 spots twice a week", "Pheromone traps @ 5/acre"],
    emergency: ["Whorl-directed spray within 48 hours", "Reseed heavily damaged patches"],
  },
  {
    name: "Whitefly",
    crops: ["Cotton", "Tomato", "Groundnut"],
    idealTemp: 32,
    idealHumidity: 55,
    idealRain: 8,
    seasons: ["Summer", "Kharif"],
    stages: ["Vegetative", "Flowering"],
    windowDays: 5,
    organic: ["Yellow sticky traps @ 10/acre", "Neem soap spray weekly"],
    chemical: ["Diafenthiuron 50 WP @ 240 g/acre", "Flonicamid 50 WG"],
    monitoring: ["Count adults on 3 top leaves per plant", "Watch for sooty mould"],
    emergency: ["Remove virus-infected plants", "Rotate insecticide mode of action"],
  },
  {
    name: "Aphids",
    crops: ["Wheat", "Tomato", "Groundnut", "Maize"],
    idealTemp: 22,
    idealHumidity: 70,
    idealRain: 15,
    seasons: ["Rabi"],
    stages: ["Seedling", "Vegetative", "Flowering"],
    windowDays: 6,
    organic: ["Release ladybird beetles", "Neem seed kernel extract 5%"],
    chemical: ["Imidacloprid 17.8 SL @ 40 ml/acre", "Thiamethoxam 25 WG"],
    monitoring: ["Inspect 20 tillers for colonies", "Check for honeydew and ants"],
    emergency: ["Border spray to stop migration", "Irrigate to reduce plant stress"],
  },
  {
    name: "Sugarcane Early Shoot Borer",
    crops: ["Sugarcane"],
    idealTemp: 30,
    idealHumidity: 65,
    idealRain: 18,
    seasons: ["Summer", "Kharif"],
    stages: ["Seedling", "Vegetative"],
    windowDays: 8,
    organic: ["Trash mulching between rows", "Trichogramma chilonis @ 2.5 cc/acre"],
    chemical: ["Chlorantraniliprole 18.5 SC @ 150 ml/acre", "Fipronil 0.3 G soil application"],
    monitoring: ["Count dead-hearts fortnightly", "Check for bore holes near base"],
    emergency: ["Earth up and irrigate immediately", "Remove dead-heart shoots"],
  },
];

export interface PestPrediction {
  name: string;
  riskScore: number;
  risk: RiskLevel;
  severity: "Low" | "Moderate" | "High";
  windowDays: number;
  action: string;
  organic: string[];
  chemical: string[];
  monitoring: string[];
  emergency: string[];
}

const bell = (value: number, ideal: number, spread: number) =>
  Math.exp(-Math.pow(value - ideal, 2) / (2 * spread * spread));

export function predictPests(input: PestInput): PestPrediction[] {
  return PESTS.map((p): PestPrediction => {
    const cropFit = p.crops.includes(input.crop) ? 1 : 0.35;
    const temp = bell(input.temperature, p.idealTemp, 5);
    const hum = bell(input.humidity, p.idealHumidity, 14);
    const rain = bell(input.rainfall, p.idealRain, 20);
    const season = p.seasons.includes(input.season) ? 1 : 0.55;
    const stage = p.stages.includes(input.stage) ? 1 : 0.6;
    const raw = cropFit * season * stage * (temp * 0.38 + hum * 0.34 + rain * 0.28);
    const riskScore = Math.round(Math.max(3, Math.min(97, raw * 108)));
    const risk: RiskLevel = riskScore >= 60 ? "High" : riskScore >= 35 ? "Medium" : "Low";
    const severity: PestPrediction["severity"] =
      riskScore >= 60 ? "High" : riskScore >= 35 ? "Moderate" : "Low";
    const action =
      riskScore >= 60
        ? "Apply preventive treatment now"
        : riskScore >= 35
          ? "Increase scouting and prepare treatment"
          : "Routine monitoring is sufficient";
    return {
      name: p.name,
      riskScore,
      risk,
      severity,
      windowDays: p.windowDays,
      action,
      organic: p.organic,
      chemical: p.chemical,
      monitoring: p.monitoring,
      emergency: p.emergency,
    };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

/** 14-day forward risk trend for the top pest, driven by the same model. */
export function pestTrend(input: PestInput, top: PestPrediction) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = i * 2;
    const drift = Math.sin((day + input.temperature) / 5) * 6;
    return {
      day: `D+${day}`,
      risk: Math.max(3, Math.min(98, Math.round(top.riskScore + drift + day * 0.9))),
    };
  });
}

export function seasonalRisk(input: PestInput) {
  return SEASONS.map((season) => {
    const preds = predictPests({ ...input, season });
    return {
      season,
      risk: Math.round(preds.slice(0, 3).reduce((a, p) => a + p.riskScore, 0) / 3),
    };
  });
}

export function currentSeason(date = new Date()): Season {
  const m = date.getMonth() + 1;
  if (m >= 6 && m <= 10) return "Kharif";
  if (m >= 11 || m <= 2) return "Rabi";
  return "Summer";
}

export interface ZoneRisk {
  zone: string;
  crop: string;
  risk: RiskLevel;
  score: number;
  pest: string;
}

/** Maps the model onto real farm zones using their moisture/health telemetry. */
export function zoneRisks(
  zones: { name: string; crop: string; soil_moisture: number; health_score: number }[],
  input: PestInput,
): ZoneRisk[] {
  return zones.map((z) => {
    const preds = predictPests({
      ...input,
      humidity: Math.max(25, Math.min(95, z.soil_moisture + 20)),
    });
    const top = preds[0];
    const score = Math.max(3, Math.min(98, Math.round(top.riskScore + (80 - z.health_score) * 0.35)));
    const risk: RiskLevel = score >= 60 ? "High" : score >= 35 ? "Medium" : "Low";
    return { zone: z.name, crop: z.crop, risk, score, pest: top.name };
  });
}
