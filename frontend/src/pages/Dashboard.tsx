import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CloudSun, Leaf, MapPin, Ruler, Sprout, TrendingUp, Wheat } from "lucide-react";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useFarmData } from "@/hooks/useFarm";
import { climateRisk, formatINR, getWeather, simulate } from "@/lib/agri";
import { baselineInput, cropKeyOf } from "@/lib/farm-defaults";
import { nearbyOutbreaks, RISK_TONE } from "@/lib/disease-intel";
import { currentSeason, predictPests } from "@/lib/pest-engine";
import { simulateDroneScan } from "@/lib/drone";
import { scanStats, useConsultations, useDiseaseScans } from "@/hooks/useIntel";

const RISK_COLOR: Record<string, string> = {
  Low: "var(--success)",
  Moderate: "var(--warning)",
  High: "var(--warning)",
  Severe: "var(--danger)",
};

export default function Dashboard() {
  const { data, isLoading } = useFarmData();
  const scanRows = useDiseaseScans().data ?? [];
  const consults = useConsultations().data ?? [];
  const farm = data?.farm ?? null;
  const zones = data?.zones ?? [];
  const input = baselineInput(farm);
  const result = simulate(input);
  const weather = getWeather(farm?.location ?? "Tamil Nadu");
  const risk = climateRisk(weather, cropKeyOf(farm?.current_crop));

  if (isLoading) {
    return (
      <AppShell title="Farm Dashboard">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </AppShell>
    );
  }

  const stats = scanStats(scanRows);
  const topPest = predictPests({
    crop: input.crop,
    temperature: weather.temperature,
    humidity: weather.humidity,
    rainfall: Math.round(weather.forecast.reduce((a, f) => a + f.rain, 0)),
    season: currentSeason(),
    stage: "Vegetative",
  })[0];
  const scan = simulateDroneScan(
    zones.map((z) => ({
      name: z.name,
      crop: z.crop,
      area: z.area,
      health_score: z.health_score,
      soil_moisture: z.soil_moisture,
      growth_stage: z.growth_stage,
    })),
  );
  const today = new Date().toDateString();
  const consultsToday = consults.filter((c) => new Date(c.created_at).toDateString() === today).length;
  const outbreakAlerts = nearbyOutbreaks(farm?.location ?? "Tamil Nadu", farm?.current_crop).filter((o) => o.risk !== "Low").length;
  const avgZoneHealth = zones.length ? zones.reduce((a, z) => a + z.health_score, 0) / zones.length : 80;
  const farmHealthIndex = Math.round(
    Math.max(0, Math.min(100, avgZoneHealth * 0.5 + (100 - risk.score) * 0.3 + result.sustainabilityScore * 0.2)),
  );

  const zoneChart = zones.map((z) => ({ name: z.name.replace(" Field", ""), health: z.health_score, moisture: z.soil_moisture }));
  const cropMix = zones.map((z) => ({ name: z.crop, value: Number(z.area) }));
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return (
    <AppShell title="Farm Dashboard" subtitle={`${data?.profile?.full_name || "Farmer"} · ${farm?.name ?? "My Farm"}`}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Farm overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row icon={<MapPin className="size-4" />} label="Location" value={farm?.location || "—"} />
            <Row icon={<Ruler className="size-4" />} label="Total land area" value={`${farm?.total_area ?? 0} acres`} />
            <Row icon={<Wheat className="size-4" />} label="Current crop" value={farm?.current_crop || "—"} />
            <Row icon={<Sprout className="size-4" />} label="Soil type" value={farm?.soil_type || "—"} />
            <Row icon={<CloudSun className="size-4" />} label="Water source" value={farm?.water_source || "—"} />
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/profile">Edit farm details</Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <ScoreCard
            icon={<Wheat className="size-5" />}
            label="Crop Yield Prediction"
            value={`${result.totalYield} t`}
            hint={`${result.yieldPerAcre} t/acre of ${input.crop}`}
            progress={Math.min(100, (result.yieldPerAcre / (result.yieldPerAcre + 1)) * 100)}
          />
          <ScoreCard
            icon={<CloudSun className="size-5" />}
            label="Climate Risk Level"
            value={`${risk.score}% ${risk.label}`}
            hint={`${weather.temperature}°C · ${weather.humidity}% humidity`}
            progress={risk.score}
            color={RISK_COLOR[risk.label]}
          />
          <ScoreCard
            icon={<TrendingUp className="size-5" />}
            label="Expected Profit"
            value={formatINR(result.profit)}
            hint={`Revenue ${formatINR(result.revenue)} · Cost ${formatINR(result.investment)}`}
            progress={Math.max(0, Math.min(100, (result.profit / Math.max(1, result.revenue)) * 100))}
          />
          <ScoreCard
            icon={<Leaf className="size-5" />}
            label="Sustainability Score"
            value={`${result.sustainabilityScore}/100`}
            hint={`Grade ${result.sustainability.grade}`}
            progress={result.sustainabilityScore}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MiniCard
          label="Active disease alerts"
          value={String(stats.active)}
          hint={`${stats.critical} critical`}
          to="/crop-health"
          color={stats.active ? "var(--warning)" : undefined}
        />
        <MiniCard label="Pest risk summary" value={`${topPest.riskScore}%`} hint={topPest.name} to="/pest-prediction" color={RISK_TONE[topPest.risk]} />
        <MiniCard label="Drone scan summary" value={`${scan.healthyPct}% healthy`} hint={`${scan.stressPct}% stress zones`} to="/drone" />
        <MiniCard label="Voice consultations today" value={String(consultsToday)} hint="Tamil & English" to="/voice-doctor" />
        <MiniCard label="Farm health index" value={`${farmHealthIndex}/100`} hint={`${outbreakAlerts} nearby outbreak alerts`} to="/twin" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Zone health & soil moisture</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="health" name="Health %" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="moisture" name="Moisture %" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Crop mix (acres)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={cropMix} dataKey="value" nameKey="name" outerRadius={80} label>
                  {cropMix.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">7-day weather outlook</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weather.forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="temp" name="Temp °C" stroke="var(--chart-4)" strokeWidth={2} />
                <Line type="monotone" dataKey="rain" name="Rain mm" stroke="var(--chart-3)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AI recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[...risk.recommendations, ...result.recommendations].slice(0, 4).map((r) => (
              <p key={r} className="rounded-lg bg-secondary p-3 text-secondary-foreground">
                {r}
              </p>
            ))}
            <Button asChild size="sm" className="w-full">
              <Link to="/simulation">Run a what-if simulation</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Row({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function MiniCard({
  label,
  value,
  hint,
  to,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  to: string;
  color?: string;
}) {
  return (
    <Card className="transition-transform hover:-translate-y-0.5">
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold" style={color ? { color } : undefined}>
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        <Button asChild size="sm" variant="ghost" className="mt-2 h-7 px-2 text-xs">
          <Link to={to}>Open</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ScoreCard({
  icon,
  label,
  value,
  hint,
  progress,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  progress: number;
  color?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold" style={color ? { color } : undefined}>
          {value}
        </p>
        <Progress value={Math.round(progress)} className="mt-3" />
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
        <Badge variant="secondary" className="mt-2 text-[10px]">
          AI modelled
        </Badge>
      </CardContent>
    </Card>
  );
}
