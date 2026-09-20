import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Radar, Satellite, Sparkle } from "lucide-react";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useFarmData } from "@/hooks/useFarm";
import { STRESS_META, simulateDroneScan, type DroneZoneReport } from "@/lib/drone";

export default function DronePage() {
  const { data, isLoading } = useFarmData();
  const zones = data?.zones ?? [];
  const scan = useMemo(
    () =>
      simulateDroneScan(
        zones.map((z) => ({
          name: z.name,
          crop: z.crop,
          area: z.area,
          health_score: z.health_score,
          soil_moisture: z.soil_moisture,
          growth_stage: z.growth_stage,
        })),
      ),
    [zones],
  );
  const [hover, setHover] = useState<DroneZoneReport | null>(null);
  const [selected, setSelected] = useState(0);

  if (isLoading) {
    return (
      <AppShell title="Drone Intelligence">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </AppShell>
    );
  }

  const active = hover ?? scan.zones[selected] ?? null;

  return (
    <AppShell title="Smart Farm Drone Intelligence" subtitle="Simulated aerial scan analytics for your farm">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Overview label="Total farm area" value={`${scan.totalArea} acres`} icon={<Satellite className="size-4" />} />
        <Overview label="Healthy crops" value={`${scan.healthyPct}%`} icon={<Activity className="size-4" />} tone="var(--success)" />
        <Overview label="Stress zones" value={`${scan.stressPct}%`} icon={<Radar className="size-4" />} tone="var(--warning)" />
        <Overview label="Critical zones" value={`${scan.criticalPct}%`} icon={<Radar className="size-4" />} tone="var(--danger)" />
        <Overview
          label="Last scan"
          value={scan.lastScan.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          icon={<Satellite className="size-4" />}
        />
        <Overview label="Scan coverage" value={`${scan.coverage}%`} icon={<Activity className="size-4" />} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Crop stress heatmap</CardTitle>
            <CardDescription>Hover a cell to inspect the zone it belongs to.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="grid gap-1 rounded-xl border border-border p-2"
              style={{ gridTemplateColumns: `repeat(${scan.cols}, minmax(0, 1fr))` }}
              onMouseLeave={() => setHover(null)}
            >
              {scan.cells.map((cell, i) => (
                <button
                  type="button"
                  key={i}
                  onMouseEnter={() => setHover(scan.zones[cell.zoneIndex] ?? null)}
                  onFocus={() => setHover(scan.zones[cell.zoneIndex] ?? null)}
                  onClick={() => setSelected(cell.zoneIndex)}
                  aria-label={`${scan.zones[cell.zoneIndex]?.name ?? "Zone"} — ${STRESS_META[cell.stress].label}, health ${cell.health}%`}
                  className="aspect-square rounded-[3px] transition-transform hover:scale-110"
                  style={{ background: STRESS_META[cell.stress].color, opacity: 0.35 + (cell.health / 100) * 0.5 }}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {(Object.keys(STRESS_META) as (keyof typeof STRESS_META)[]).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="size-3 rounded-sm" style={{ background: STRESS_META[k].color }} />
                  {STRESS_META[k].label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Drone scan report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!active ? (
              <p className="text-muted-foreground">No zones scanned yet.</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold">{active.name}</p>
                  <Badge variant="secondary">{active.stressLevel} stress</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {active.crop} · {active.area} acres
                </p>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Health score</span>
                    <span>{active.healthScore}%</span>
                  </div>
                  <Progress value={active.healthScore} />
                </div>
                <div>
                  <p className="mb-1 font-medium">Detected issues</p>
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    {active.issues.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
                <p className="rounded-lg bg-secondary p-3 text-secondary-foreground">
                  <span className="font-medium">Suggested action: </span>
                  {active.action}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vegetation analytics</CardTitle>
          </CardHeader>
          <CardContent className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scan.vegetation}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="metric" stroke="var(--muted-foreground)" fontSize={10} interval={0} angle={-12} dy={8} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="value" name="Index" radius={[6, 6, 0, 0]}>
                  {scan.vegetation.map((v, i) => (
                    <Cell key={v.metric} fill={`var(--chart-${(i % 5) + 1})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Weekly health vs stress trend</CardTitle>
          </CardHeader>
          <CardContent className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={scan.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip />
                <Area type="monotone" dataKey="health" name="Health %" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.25} />
                <Area type="monotone" dataKey="stress" name="Stress %" stroke="var(--chart-4)" fill="var(--chart-4)" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkle className="size-4" /> Drone insights AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {scan.insights.map((i) => (
            <p key={i} className="rounded-lg bg-secondary p-3 text-secondary-foreground">
              {i}
            </p>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Overview({ label, value, icon, tone }: { label: string; value: string; icon: ReactNode; tone?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-bold" style={tone ? { color: tone } : undefined}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
