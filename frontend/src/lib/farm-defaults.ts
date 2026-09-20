import { CROPS, getWeather, type CropKey, type SimulationInput } from "@/lib/agri";
import type { Farm } from "@/hooks/useFarm";

export function cropKeyOf(value: string | undefined | null): CropKey {
  return (value && value in CROPS ? value : "Rice") as CropKey;
}

/** Builds the baseline simulation input for a farm from its current weather. */
export function baselineInput(farm: Farm | null): SimulationInput {
  const crop = cropKeyOf(farm?.current_crop);
  const weather = getWeather(farm?.location ?? "Tamil Nadu");
  const observed = weather.forecast.reduce((a, f) => a + f.rain, 0) * 14;
  const need = CROPS[crop].idealRain * CROPS[crop].waterDemand;
  // Blend the short-range forecast with the crop's seasonal water need so the
  // baseline scenario stays realistic instead of swinging to drought/flood.
  // Irrigation contributes 6mm per point, so leave room for it in the rain baseline.
  const target = Math.max(need * 0.3, need - 60 * 6);
  const seasonalRain = Math.min(target * 1.15, Math.max(target * 0.85, observed * 0.25 + target * 0.75));
  return {
    crop,
    farmSize: Number(farm?.total_area ?? 5),
    rainfall: Math.round(seasonalRain),
    temperature: weather.temperature,
    irrigation: 60,
    fertilizer: CROPS[crop].idealFertilizer,
    soilQuality: 72,
    pestControl: 70,
  };
}
