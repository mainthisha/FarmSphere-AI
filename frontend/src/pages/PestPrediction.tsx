import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bug, ShieldAlert, Sprout, Timer } from "lucide-react";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { CROP_LIST, getWeather } from "@/lib/agri";
import { RISK_TONE, type RiskLevel } from "@/lib/disease-intel";
import {
  GROWTH_STAGES,
  SEASONS,
  currentSeason,
  pestTrend,
  predictPests,
  seasonalRisk,
  zoneRisks,
  type GrowthStage,
  type PestInput,
  type Season,
} from "@/lib/pest-engine";
import { cropKeyOf } from "@/lib/farm-defaults";
import { useFarmData } from "@/hooks/useFarm";

export default function PestPredictionPage() {
  const { data } = useFarmData();
  const farm = data?.farm ?? null;
  const zones = data?.zones ?? [];
  const weather = getWeather(farm?.location ?? "Tamil Nadu");

  const [crop, setCrop] = useState(cropKeyOf(farm?.current_crop));
  const [temperature, setTemperature] = useState(weather.temperature);
  const [humidity, setHumidity] = useState(weather.humidity);
  const [rainfall, setRainfall] = useState(Math.round(weather.forecast.reduce((a, f) => a + f.rain, 0)));
  const [season, setSeason] = useState<Season>(currentSeason());
  const [stage, setStage] = useState<GrowthStage>("Vegetative");

  const input: PestInput = { crop, temperature, humidity, rainfall, season, stage };
  const predictions = useMemo(() => predictPests(input), [crop, temperature, humidity, rainfall, season, stage]);
  const top = predictions[0];
  const trend = useMemo(() => pestTrend(input, top), [input, top]);
  const seasonal = useMemo(() => seasonalRisk(input), [input]);
  const zoneMap = useMemo(
    () =>
      zoneRisks(
        zones.map((z) => ({
          name: z.name,
          crop: z.crop,
          soil_moisture: z.soil_moisture,
          health_score: z.health_score,
        })),
        input,
      ),
    [zones, input],
  );

  const buckets: Record<RiskLevel, number> = { High: 0, Medium: 0, Low: 0 };
  predictions.forEach((p) => (buckets[p.risk] += 1));

  return (
    <AppShell title="AI Pest Outbreak Prediction" subtitle="Forecast pest pressure before an attack begins">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prediction inputs</CardTitle>
            <CardDescription>Pre-filled from your farm and today's weather.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <Label>Crop type</Label>
              <Select value={crop} onValueChange={(v) => setCrop(cropKeyOf(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CROP_LIST.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SliderRow label="Temperature" unit="°C" value={temperature} min={10} max={45} onChange={setTemperature} />
            <SliderRow label="Humidity" unit="%" value={humidity} min={20} max={100} onChange={setHumidity} />
            <SliderRow label="Weekly rainfall" unit="mm" value={rainfall} min={0} max={200} onChange={setRainfall} />
            <div className="space-y-2">
              <Label>Season</Label>
              <Select value={season} onValueChange={(v) => setSeason(v as Season)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEASONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Growth stage</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as GrowthStage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROWTH_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:col-span-2">
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bug className="size-4" /> Primary prediction
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-4">
              <Stat label="Pest" value={top.name} />
              <Stat label="Risk score" value={`${top.riskScore}%`} color={RISK_TONE[top.risk]} />
              <Stat label="Prediction window" value={`${top.windowDays} days`} />
              <Stat label="Severity" value={top.severity} color={RISK_TONE[top.risk]} />
              <p className="sm:col-span-4 rounded-lg bg-background p-3 text-sm">
                <span className="font-medium">Recommended action: </span>
                {top.action}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <RiskBucket label="High risk pests" count={buckets.High} tone="var(--danger)" />
            <RiskBucket label="Medium risk pests" count={buckets.Medium} tone="var(--warning)" />
            <RiskBucket label="Low risk pests" count={buckets.Low} tone="var(--success)" />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pest risk trend (next 12 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="risk" name={`${top.name} risk %`} stroke="var(--chart-4)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Seasonal risk analysis</CardTitle>
          </CardHeader>
          <CardContent className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seasonal}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="season" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="risk" name="Avg risk %" radius={[6, 6, 0, 0]}>
                  {seasonal.map((s) => (
                    <Cell key={s.season} fill={s.season === season ? "var(--chart-1)" : "var(--chart-2)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pest frequency analytics</CardTitle>
            <CardDescription>Modelled risk for every pest tracked for your conditions.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={predictions} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis type="category" dataKey="name" width={170} stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip />
                <Bar dataKey="riskScore" name="Risk %" radius={[0, 6, 6, 0]}>
                  {predictions.map((p) => (
                    <Cell key={p.name} fill={RISK_TONE[p.risk]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sprout className="size-4" /> Interactive pest map
          </CardTitle>
          <CardDescription>Zone-level risk using live moisture and health telemetry.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {zoneMap.length === 0 ? (
            <p className="text-sm text-muted-foreground">No farm zones yet — add zones to see the map.</p>
          ) : (
            zoneMap.map((z) => (
              <div
                key={z.zone}
                className="rounded-xl border p-4 transition-transform hover:-translate-y-0.5"
                style={{ borderColor: RISK_TONE[z.risk], background: `color-mix(in oklch, ${RISK_TONE[z.risk]} 12%, transparent)` }}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{z.zone}</p>
                  <Badge variant="secondary">{z.risk} risk</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {z.crop} · likely pest {z.pest}
                </p>
                <Progress value={z.score} className="mt-3" />
                <p className="mt-2 text-xs text-muted-foreground">Risk score {z.score}%</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionCard title="Organic prevention" items={top.organic} icon={<Sprout className="size-4" />} />
        <ActionCard title="Chemical prevention" items={top.chemical} icon={<ShieldAlert className="size-4" />} />
        <ActionCard title="Monitoring guidelines" items={top.monitoring} icon={<Timer className="size-4" />} />
        <ActionCard title="Emergency actions" items={top.emergency} icon={<Bug className="size-4" />} />
      </div>
    </AppShell>
  );
}

function SliderRow({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <Label>{label}</Label>
        <span className="text-muted-foreground">
          {value}
          {unit}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}

function RiskBucket({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-3xl font-bold" style={{ color: tone }}>
          {count}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function ActionCard({ title, items, icon }: { title: string; items: string[]; icon: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
