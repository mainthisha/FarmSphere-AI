import { useMemo, useState } from "react";
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import { Leaf, Recycle } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { useFarmData } from "@/hooks/useFarm";
import { computeSustainability, type SimulationInput } from "@/lib/agri";
import { baselineInput } from "@/lib/farm-defaults";

export default function SustainabilityPage() {
  const { data } = useFarmData();
  const base = useMemo(() => baselineInput(data?.farm ?? null), [data?.farm]);
  const [input, setInput] = useState<SimulationInput | null>(null);
  const current = input ?? base;
  const s = computeSustainability(current);

  const set = (patch: Partial<SimulationInput>) => setInput({ ...current, ...patch });

  const pillars = [
    { label: "Water efficiency", value: s.waterEfficiency },
    { label: "Fertilizer usage", value: s.fertilizerUsage },
    { label: "Soil health", value: s.soilHealth },
    { label: "Carbon reduction", value: s.carbonReduction },
  ];

  return (
    <AppShell title="Green Farm Score" subtitle="Sustainability performance of your farm">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Leaf className="size-4" /> Sustainability Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  data={[{ name: "score", value: s.score, fill: "var(--chart-2)" }]}
                  innerRadius="72%"
                  outerRadius="100%"
                  startAngle={220}
                  endAngle={-40}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar dataKey="value" cornerRadius={12} background />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="text-4xl font-extrabold text-primary">{s.score}/100</p>
                  <Badge className="mt-2">Grade {s.grade}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Score components</CardTitle>
            <CardDescription>Weighted: water 30%, fertilizer 25%, soil 25%, carbon 20%.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pillars.map((p) => (
              <div key={p.label}>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>{p.label}</span>
                  <span>{Math.round(p.value)}%</span>
                </div>
                <Progress value={p.value} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Recycle className="size-4" /> Improvement suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {s.suggestions.map((sg) => (
              <p key={sg} className="rounded-lg bg-secondary p-3 text-secondary-foreground">
                {sg}
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Try a greener plan</CardTitle>
            <CardDescription>Adjust practices to see the score respond.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <SliderField label="Irrigation" unit="%" value={current.irrigation} min={0} max={100} onChange={(v) => set({ irrigation: v })} />
            <SliderField label="Fertilizer" unit="kg/acre" value={current.fertilizer} min={0} max={260} step={5} onChange={(v) => set({ fertilizer: v })} />
            <SliderField label="Soil quality" unit="%" value={current.soilQuality} min={10} max={100} onChange={(v) => set({ soilQuality: v })} />
          </CardContent>
        </Card>
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
