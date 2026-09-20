import { useState, type ReactNode } from "react";
import { Droplets, Leaf, Sprout, Thermometer } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useFarmData, type FarmZone } from "@/hooks/useFarm";
import { getWeather } from "@/lib/agri";
import { cn } from "@/lib/utils";

function healthTone(score: number) {
  if (score >= 85) return "var(--success)";
  if (score >= 70) return "var(--chart-2)";
  if (score >= 55) return "var(--warning)";
  return "var(--danger)";
}

export default function TwinPage() {
  const { data, isLoading } = useFarmData();
  const zones = data?.zones ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected: FarmZone | null = zones.find((z) => z.id === selectedId) ?? zones[0] ?? null;
  const weather = getWeather(data?.farm?.location ?? "Tamil Nadu");

  return (
    <AppShell title="Digital Twin Farm" subtitle={data?.farm?.name ?? "Virtual farm visualization"}>
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Farm map</CardTitle>
              <p className="text-xs text-muted-foreground">Tap a crop zone to view its live twin data.</p>
            </CardHeader>
            <CardContent>
              <div
                className="grid grid-cols-2 gap-3 rounded-2xl p-3"
                style={{ background: "var(--gradient-sky)" }}
              >
                {zones.map((zone) => {
                  const active = selected?.id === zone.id;
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => setSelectedId(zone.id)}
                      className={cn(
                        "group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all",
                        active ? "border-primary shadow-[var(--shadow-soft)]" : "border-transparent hover:border-primary/40",
                      )}
                      style={{ background: "var(--card)" }}
                    >
                      <div
                        className="absolute inset-x-0 top-0 h-1.5"
                        style={{ background: healthTone(zone.health_score) }}
                      />
                      <p className="text-sm font-semibold">{zone.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {zone.crop} · {Number(zone.area)} acres
                      </p>
                      <div className="mt-4 flex items-end justify-between">
                        <div>
                          <p className="text-2xl font-bold" style={{ color: healthTone(zone.health_score) }}>
                            {zone.health_score}%
                          </p>
                          <p className="text-[11px] text-muted-foreground">crop health</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-primary">{zone.soil_moisture}%</p>
                          <p className="text-[11px] text-muted-foreground">soil moisture</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="mt-3 text-[10px]">
                        {zone.growth_stage}
                      </Badge>
                    </button>
                  );
                })}
              </div>
              {zones.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No crop zones yet — save your farm details in Profile to generate your twin.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{selected ? selected.name : "Zone details"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {selected ? (
                  <>
                    <Metric label="Crop" value={selected.crop} icon={<Sprout className="size-4" />} />
                    <Metric label="Growth stage" value={selected.growth_stage} icon={<Leaf className="size-4" />} />
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>Crop health</span>
                        <span>{selected.health_score}%</span>
                      </div>
                      <Progress value={selected.health_score} />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>Soil moisture</span>
                        <span>{selected.soil_moisture}%</span>
                      </div>
                      <Progress value={selected.soil_moisture} />
                    </div>
                    <Metric
                      label="Irrigation status"
                      value={selected.soil_moisture < 45 ? "Irrigation needed" : "Adequate"}
                      icon={<Droplets className="size-4" />}
                    />
                    <p className="rounded-lg bg-secondary p-3 text-secondary-foreground">
                      {selected.health_score < 70
                        ? `${selected.name} is under stress. Inspect for pests and irrigate within 48 hours.`
                        : `${selected.name} is performing well. Maintain the current schedule.`}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Select a zone on the map.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Field conditions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Metric label="Temperature" value={`${weather.temperature}°C`} icon={<Thermometer className="size-4" />} />
                <Metric label="Humidity" value={`${weather.humidity}%`} icon={<Droplets className="size-4" />} />
                <Metric label="Rain today" value={`${weather.rainfall} mm`} icon={<Droplets className="size-4" />} />
                <Metric label="Soil type" value={data?.farm?.soil_type ?? "—"} icon={<Sprout className="size-4" />} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
