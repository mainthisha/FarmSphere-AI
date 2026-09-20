// Disease intelligence heuristics: severity, spread prediction, affected-area
// mapping and nearby outbreak simulation. Pure functions, no side effects.

export type RiskLevel = "Low" | "Medium" | "High";

export interface SeverityAnalysis {
  severityPct: number;
  infectionLevel: "Healthy" | "Low Infection" | "Moderate Infection" | "Critical Infection";
  risk: RiskLevel;
  tone: "success" | "warning" | "danger";
}

const SEVERITY_WEIGHT: Record<string, number> = { low: 0.22, medium: 0.48, high: 0.78 };

/** Converts the model's confidence + coarse severity label into a numeric analysis. */
export function analyseSeverity(opts: {
  confidence: number;
  severity?: string;
  healthy?: boolean;
}): SeverityAnalysis {
  if (opts.healthy) {
    return { severityPct: 0, infectionLevel: "Healthy", risk: "Low", tone: "success" };
  }
  const weight = SEVERITY_WEIGHT[(opts.severity ?? "medium").toLowerCase()] ?? 0.48;
  const severityPct = Math.max(4, Math.min(96, Math.round(weight * (40 + opts.confidence * 0.7))));
  const infectionLevel =
    severityPct < 25 ? "Low Infection" : severityPct < 55 ? "Moderate Infection" : "Critical Infection";
  const risk: RiskLevel = severityPct < 20 ? "Low" : severityPct < 50 ? "Medium" : "High";
  const tone = severityPct < 25 ? "success" : severityPct < 55 ? "warning" : "danger";
  return { severityPct, infectionLevel, risk, tone };
}

export interface ProgressionPoint {
  label: string;
  day: number;
  infection: number;
}

export interface ProgressionForecast {
  points: ProgressionPoint[];
  trend: "Increasing" | "Stable" | "Contained";
  dailyRate: number;
}

/** Logistic spread model — infection accelerates then saturates near 95%. */
export function predictProgression(severityPct: number, risk: RiskLevel): ProgressionForecast {
  const rate = risk === "High" ? 0.17 : risk === "Medium" ? 0.11 : 0.06;
  const start = Math.max(2, severityPct);
  const at = (day: number) => {
    const k = start / (100 - start || 1);
    const grown = k * Math.exp(rate * day);
    return Math.round(Math.min(95, (grown / (1 + grown)) * 100));
  };
  const points: ProgressionPoint[] = [
    { label: "Today", day: 0, infection: Math.round(start) },
    { label: "3 days", day: 3, infection: at(3) },
    { label: "7 days", day: 7, infection: at(7) },
    { label: "14 days", day: 14, infection: at(14) },
  ];
  const delta = points[3].infection - points[0].infection;
  return {
    points,
    trend: delta > 8 ? "Increasing" : delta > 2 ? "Stable" : "Contained",
    dailyRate: Math.round((delta / 14) * 10) / 10,
  };
}

export type CellState = "healthy" | "moderate" | "severe";

export interface AffectedAreaMap {
  grid: CellState[];
  cols: number;
  affectedPct: number;
  healthyPct: number;
  severePct: number;
  moderatePct: number;
}

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Builds a deterministic heat-map of the leaf/plot: infection clusters around a
 * focal point instead of being random noise, which is how lesions actually spread.
 */
export function mapAffectedArea(severityPct: number, seed: string, cols = 12, rows = 12): AffectedAreaMap {
  const rnd = hash(seed || "scan");
  const focus = { x: rnd() * cols, y: rnd() * rows };
  const radius = (severityPct / 100) * cols * 0.95 + 1;
  const grid: CellState[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = Math.hypot(x - focus.x, y - focus.y) + rnd() * 1.6 - 0.8;
      grid.push(d < radius * 0.55 ? "severe" : d < radius ? "moderate" : "healthy");
    }
  }
  const total = grid.length;
  const severe = grid.filter((c) => c === "severe").length;
  const moderate = grid.filter((c) => c === "moderate").length;
  const affectedPct = Math.round(((severe + moderate) / total) * 100);
  return {
    grid,
    cols,
    affectedPct,
    healthyPct: 100 - affectedPct,
    severePct: Math.round((severe / total) * 100),
    moderatePct: Math.round((moderate / total) * 100),
  };
}

export interface Outbreak {
  disease: string;
  crop: string;
  reports: number;
  risk: RiskLevel;
  region: string;
  distanceKm: number;
  trend: { week: string; cases: number }[];
}

const REGIONS = ["Thanjavur", "Tiruchirappalli", "Erode", "Madurai", "Salem", "Villupuram"];
const DISEASES = [
  { disease: "Rice Blast", crop: "Rice" },
  { disease: "Bacterial Leaf Blight", crop: "Rice" },
  { disease: "Red Rot", crop: "Sugarcane" },
  { disease: "Leaf Curl Virus", crop: "Cotton" },
  { disease: "Tikka Leaf Spot", crop: "Groundnut" },
  { disease: "Early Blight", crop: "Tomato" },
];

/** Simulated regional surveillance feed, stable for a given location. */
export function nearbyOutbreaks(location: string, currentCrop?: string | null): Outbreak[] {
  const rnd = hash(location || "Tamil Nadu");
  const list = DISEASES.map((d, i) => {
    const boost = currentCrop && d.crop === currentCrop ? 6 : 0;
    const reports = Math.round(2 + rnd() * 12) + boost;
    const risk: RiskLevel = reports > 12 ? "High" : reports > 6 ? "Medium" : "Low";
    const trend = ["W-4", "W-3", "W-2", "W-1", "Now"].map((week, k) => ({
      week,
      cases: Math.max(0, Math.round(reports * (0.35 + k * 0.18) + (rnd() * 4 - 2))),
    }));
    return {
      ...d,
      reports,
      risk,
      region: REGIONS[(i + Math.floor(rnd() * 3)) % REGIONS.length],
      distanceKm: Math.round(4 + rnd() * 40),
      trend,
    };
  });
  return list.sort((a, b) => b.reports - a.reports);
}

export const RISK_TONE: Record<RiskLevel, string> = {
  Low: "var(--success)",
  Medium: "var(--warning)",
  High: "var(--danger)",
};
