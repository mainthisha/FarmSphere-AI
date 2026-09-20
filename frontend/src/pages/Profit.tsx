import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { IndianRupee } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFarmData } from "@/hooks/useFarm";
import { CROPS, CROP_LIST, formatINR, simulate, type CropKey } from "@/lib/agri";
import { baselineInput } from "@/lib/farm-defaults";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export default function ProfitPage() {
  const { data } = useFarmData();
  const base = useMemo(() => baselineInput(data?.farm ?? null), [data?.farm]);
  const [crop, setCrop] = useState<CropKey>(base.crop);
  const [form, setForm] = useState({
    farmSize: String(base.farmSize),
    seed: "3500",
    fertilizer: "6500",
    labour: "9000",
    price: String(CROPS[base.crop].price),
  });

  const size = Math.max(0.1, Number(form.farmSize) || 1);
  const seed = Number(form.seed) || 0;
  const fert = Number(form.fertilizer) || 0;
  const labour = Number(form.labour) || 0;
  const price = Number(form.price) || CROPS[crop].price;

  const sim = simulate({ ...base, crop, farmSize: size, marketPrice: price });
  const investment = (seed + fert + labour) * size;
  const revenue = sim.totalYield * price;
  const profit = revenue - investment;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  const costs = [
    { name: "Seed", value: seed * size },
    { name: "Fertilizer", value: fert * size },
    { name: "Labour", value: labour * size },
  ];
  const compare = CROP_LIST.map((c) => {
    const s = simulate({ ...base, crop: c, farmSize: size });
    return { name: c, Profit: Math.round((s.revenue - investment) / 1000) };
  });

  return (
    <AppShell title="Profit Prediction" subtitle="Season financials for your farm">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <IndianRupee className="size-4" /> Inputs
            </CardTitle>
            <CardDescription>All costs are per acre.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Crop type</Label>
              <Select
                value={crop}
                onValueChange={(v) => {
                  setCrop(v as CropKey);
                  setForm((f) => ({ ...f, price: String(CROPS[v as CropKey].price) }));
                }}
              >
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
            <NumField label="Farm size (acres)" value={form.farmSize} onChange={(v) => setForm({ ...form, farmSize: v })} />
            <NumField label="Seed cost (₹/acre)" value={form.seed} onChange={(v) => setForm({ ...form, seed: v })} />
            <NumField label="Fertilizer cost (₹/acre)" value={form.fertilizer} onChange={(v) => setForm({ ...form, fertilizer: v })} />
            <NumField label="Labour cost (₹/acre)" value={form.labour} onChange={(v) => setForm({ ...form, labour: v })} />
            <NumField label="Market price (₹/tonne)" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                setForm({
                  farmSize: String(base.farmSize),
                  seed: "3500",
                  fertilizer: "6500",
                  labour: "9000",
                  price: String(CROPS[crop].price),
                })
              }
            >
              Reset defaults
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Expected yield" value={`${sim.totalYield} t`} />
            <Stat label="Total investment" value={formatINR(investment)} />
            <Stat label="Expected revenue" value={formatINR(revenue)} />
            <Stat
              label="Expected profit"
              value={formatINR(profit)}
              tone={profit >= 0 ? "var(--success)" : "var(--danger)"}
              sub={`${margin}% margin`}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cost breakdown</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={costs} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                      {costs.map((c, i) => (
                        <Cell key={c.name} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatINR(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Profit by crop (₹ thousands)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compare}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="Profit" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Financial guidance</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
              <p className="rounded-lg bg-secondary p-3 text-secondary-foreground">
                Break-even price is {formatINR(sim.totalYield > 0 ? investment / sim.totalYield : 0)} per tonne — sell above this to stay profitable.
              </p>
              <p className="rounded-lg bg-secondary p-3 text-secondary-foreground">
                {margin < 20
                  ? "Margin is thin. Cut fertilizer over-use or negotiate labour cost to protect profit."
                  : "Healthy margin. Consider reinvesting into drip irrigation to lower next season's water cost."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold" style={tone ? { color: tone } : undefined}>
          {value}
        </p>
        {sub ? <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}
