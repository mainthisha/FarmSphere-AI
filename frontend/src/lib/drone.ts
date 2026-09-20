// Simulated drone scan analytics derived from the farm's real zone telemetry.
// Deterministic: the same farm always produces the same scan until data changes.

export type StressType = "healthy" | "water" | "nutrient" | "disease";

export const STRESS_META: Record<StressType, { label: string; color: string }> = {
  healthy: { label: "Healthy", color: "var(--success)" },
  water: { label: "Water stress", color: "var(--warning)" },
  nutrient: { label: "Nutrient stress", color: "var(--chart-4)" },
  disease: { label: "Disease stress", color: "var(--danger)" },
};

export interface DroneZoneReport {
  name: string;
  crop: string;
  area: number;
  healthScore: number;
  stress: StressType;
  stressLevel: "None" | "Low" | "Moderate" | "Severe";
  issues: string[];
  action: string;
  density: number;
  uniformity: number;
}

export interface DroneScan {
  zones: DroneZoneReport[];
  cells: { zoneIndex: number; stress: StressType; health: number }[];
  cols: number;
  totalArea: number;
  healthyPct: number;
  stressPct: number;
  criticalPct: number;
  coverage: number;
  lastScan: Date;
  vegetation: { metric: string; value: number }[];
  trend: { day: string; health: number; stress: number }[];
  insights: string[];
}

interface ZoneInput {
  name: string;
  crop: string;
  area: number | string;
  health_score: number;
  soil_moisture: number;
  growth_stage: string | null;
}

function classify(z: ZoneInput): { stress: StressType; issues: string[] } {
  const issues: string[] = [];
  let stress: StressType = "healthy";
  if (z.health_score < 70) {
    stress = "disease";
    issues.push("Chlorophyll index below threshold — possible pathogen activity");
  } else if (z.soil_moisture < 45) {
    stress = "water";
    issues.push("Canopy temperature elevated, soil moisture below 45%");
  } else if (z.health_score < 85) {
    stress = "nutrient";
    issues.push("Uneven NDVI response indicating nitrogen deficiency");
  }
  if (z.soil_moisture > 75) issues.push("Water-logging detected in low-lying patches");
  if (issues.length === 0) issues.push("No anomalies detected in this pass");
  return { stress, issues };
}

const ACTION: Record<StressType, string> = {
  healthy: "Continue routine monitoring",
  water: "Increase irrigation cycle by one turn this week",
  nutrient: "Apply split dose of nitrogen and micronutrient spray",
  disease: "Scout on foot and run image diagnosis within 48 hours",
};

export function simulateDroneScan(zonesInput: ZoneInput[], seedDate = new Date()): DroneScan {
  const zones: DroneZoneReport[] = zonesInput.map((z) => {
    const { stress, issues } = classify(z);
    const stressLevel =
      z.health_score >= 85 ? "None" : z.health_score >= 75 ? "Low" : z.health_score >= 65 ? "Moderate" : "Severe";
    return {
      name: z.name,
      crop: z.crop,
      area: Number(z.area),
      healthScore: z.health_score,
      stress,
      stressLevel,
      issues,
      action: ACTION[stress],
      density: Math.max(30, Math.min(99, Math.round(z.health_score * 0.9 + z.soil_moisture * 0.15))),
      uniformity: Math.max(30, Math.min(99, Math.round(100 - Math.abs(70 - z.soil_moisture) * 1.1))),
    };
  });

  const cols = 12;
  const rows = 8;
  const cells: DroneScan["cells"] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const zi = zones.length ? Math.min(zones.length - 1, Math.floor((y / rows) * 2) * 2 + Math.floor((x / cols) * 2)) : 0;
      const z = zones[zi];
      const wobble = Math.sin(x * 1.7 + y * 2.3) * 8;
      const health = z ? Math.max(20, Math.min(100, Math.round(z.healthScore + wobble))) : 80;
      const stress: StressType = !z ? "healthy" : health > 85 ? "healthy" : health > 72 ? z.stress === "healthy" ? "healthy" : z.stress : z.stress === "healthy" ? "nutrient" : z.stress;
      cells.push({ zoneIndex: zi, stress, health });
    }
  }

  const totalArea = zones.reduce((a, z) => a + z.area, 0);
  const healthyCells = cells.filter((c) => c.stress === "healthy").length;
  const criticalCells = cells.filter((c) => c.stress === "disease").length;
  const healthyPct = Math.round((healthyCells / cells.length) * 100);
  const criticalPct = Math.round((criticalCells / cells.length) * 100);

  const avgHealth = zones.length ? zones.reduce((a, z) => a + z.healthScore, 0) / zones.length : 80;
  const trend = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => ({
    day,
    health: Math.round(Math.max(30, Math.min(100, avgHealth - 4 + i * 0.9 + Math.sin(i) * 2))),
    stress: Math.round(Math.max(0, Math.min(70, 100 - avgHealth + 3 - i * 0.6))),
  }));

  const insights = zones
    .filter((z) => z.stress !== "healthy")
    .slice(0, 3)
    .map(
      (z) =>
        `${z.name} shows ${STRESS_META[z.stress].label.toLowerCase()} across roughly ${Math.max(
          10,
          100 - z.healthScore,
        )}% of its canopy, likely caused by ${
          z.stress === "water"
            ? "insufficient irrigation"
            : z.stress === "nutrient"
              ? "nutrient deficiency"
              : "an active pathogen"
        }. ${z.action}.`,
    );
  if (insights.length === 0) insights.push("All scanned zones are within healthy NDVI ranges. No action required this week.");

  return {
    zones,
    cells,
    cols,
    totalArea: Math.round(totalArea * 10) / 10,
    healthyPct,
    stressPct: 100 - healthyPct,
    criticalPct,
    coverage: 100,
    lastScan: new Date(seedDate.getTime() - 42 * 60 * 1000),
    vegetation: [
      { metric: "Crop density", value: Math.round(zones.reduce((a, z) => a + z.density, 0) / (zones.length || 1)) },
      { metric: "Growth uniformity", value: Math.round(zones.reduce((a, z) => a + z.uniformity, 0) / (zones.length || 1)) },
      { metric: "Stress distribution", value: 100 - healthyPct },
      { metric: "Health trend", value: Math.round(avgHealth) },
    ],
    trend,
    insights,
  };
}
