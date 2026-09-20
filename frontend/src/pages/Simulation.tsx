import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RotateCcw, Wand2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useFarmData } from "@/hooks/useFarm";
import { CROP_LIST, formatINR, simulate, type CropKey, type SimulationInput } from "@/lib/agri";
import { baselineInput } from "@/lib/farm-defaults";

export default function SimulationPage() {
  const { data } = useFarmData();
  const base = useMemo(() => baselineInput(data?.farm ?? null), [data?.farm]);
  const [input, setInput] = useState<SimulationInput | null>(null);
  const scenario = input ?? base;

  const baseline = simulate(base);
  const result = simulate(scenario);

  const set = (patch: Partial<SimulationInput>) => setInput({ ...scenario, ...patch });

  const compare = [
    { name: "Yield (t)", Baseline: baseline.totalYield, Scenario: result.totalYield },
    { name: "Profit (₹k)", Baseline: Math.round(baseline.profit / 1000), Scenario: Math.round(result.profit / 1000) },
    { name: "Risk", Baseline: baseline.riskScore, Scenario: result.riskScore },
    { name: "Green score", Baseline: baseline.sustainabilityScore, Scenario: result.sustainabilityScore },
  ];

  return (
    <AppShell title="AI What-If Simulation" subtitle="Model a season on your digital twin before committing resources">
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wand2 className="size-4" /> Scenario parameters
            </CardTitle>
            <CardDescription>Adjust conditions and the model recalculates instantly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Crop type</Label>
                <Select value={scenario.crop} onValueChange={(v) => set({ crop: v as CropKey })}>
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
              <SliderField
                label="Farm size"
                unit="acres"
                value={scenario.farmSize}
                min={0.5}
                max={50}
                step={0.5}
                onChange={(v) => set({ farmSize: v })}
              />
            </div>
            <SliderField label="Rainfall" unit="mm/season" value={scenario.rainfall} min={0} max={2200} step={10} onChange={(v) => set({ rainfall: v })} />
            <SliderField label="Temperature" unit="°C" value={scenario.temperature} min={10} max={48} step={0.5} onChange={(v) => set({ temperature: v })} />
            <SliderField label="Irrigation level" unit="%" value={scenario.irrigation} min={0} max={100} onChange={(v) => set({ irrigation: v })} />
            <SliderField label="Fertilizer" unit="kg/acre" value={scenario.fertilizer} min={0} max={260} step={5} onChange={(v) => set({ fertilizer: v })} />
            <SliderField label="Soil quality" unit="%" value={scenario.soilQuality} min={10} max={100} onChange={(v) => set({ soilQuality: v })} />
            <SliderField label="Pest control" unit="%" value={scenario.pestControl} min={0} max={100} onChange={(v) => set({ pestControl: v })} />
            <Button variant="outline" className="w-full gap-2" onClick={() => setInput(null)}>
              <RotateCcw className="size-4" /> Reset to my farm baseline
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-3">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Predicted yield" value={`${result.totalYield} t`} sub={`${result.yieldPerAcre} t/acre`} />
            <Stat label="Expected profit" value={formatINR(result.profit)} sub={`Revenue ${formatINR(result.revenue)}`} />
            <Stat label="Risk score" value={`${result.riskScore}% ${result.riskLabel}`} sub={`Water used ${result.waterUsage.toLocaleString()} m³`} />
            <Stat label="Green score" value={`${result.sustainabilityScore}/100`} sub={`Grade ${result.sustainability.grade}`} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Baseline vs scenario</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compare}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="Baseline" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Scenario" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Growth factor balance</CardTitle>
              </CardHeader>
              <CardContent className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={result.factors}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
                    <Radar dataKey="value" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.35} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Risk breakdown & recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  ["Drought risk", result.droughtRisk],
                  ["Flood risk", result.floodRisk],
                  ["Heat stress", result.heatStress],
                  ["Pest pressure", result.pestRisk],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>{label}</span>
                      <span>{value}%</span>
                    </div>
                    <Progress value={value as number} />
                  </div>
                ))}
                <div className="space-y-2 pt-2">
                  {result.recommendations.map((r) => (
                    <p key={r} className="rounded-lg bg-secondary p-3 text-secondary-foreground">
                      {r}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SliderField({
  label,
  unit,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Badge variant="secondary">
          {value} {unit}
        </Badge>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold">{value}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
