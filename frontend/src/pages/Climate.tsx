import type { ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CloudRain, Droplets, Thermometer, Wind } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useFarmData } from "@/hooks/useFarm";
import { climateRisk, getWeather } from "@/lib/agri";
import { cropKeyOf } from "@/lib/farm-defaults";

const TONE: Record<string, string> = {
  Low: "var(--success)",
  Moderate: "var(--warning)",
  High: "var(--warning)",
  Severe: "var(--danger)",
};

export default function ClimatePage() {
  const { data } = useFarmData();
  const location = data?.farm?.location || data?.profile?.location || "Tamil Nadu";
  const weather = getWeather(location);
  const risk = climateRisk(weather, cropKeyOf(data?.farm?.current_crop));

  return (
    <AppShell title="Weather & Climate Risk" subtitle={location}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Thermometer className="size-5" />} label="Temperature" value={`${weather.temperature}°C`} sub={weather.condition} />
        <Metric icon={<Droplets className="size-5" />} label="Humidity" value={`${weather.humidity}%`} sub="relative humidity" />
        <Metric icon={<CloudRain className="size-5" />} label="Rainfall today" value={`${weather.rainfall} mm`} sub="last 24 hours" />
        <Metric icon={<Wind className="size-5" />} label="Wind speed" value={`${weather.windSpeed} km/h`} sub="surface wind" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">7-day rainfall & temperature forecast</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weather.forecast}>
                <defs>
                  <linearGradient id="rain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="temp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip />
                <Area type="monotone" dataKey="rain" name="Rain mm" stroke="var(--chart-3)" fill="url(#rain)" />
                <Area type="monotone" dataKey="temp" name="Temp °C" stroke="var(--chart-4)" fill="url(#temp)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Climate Risk Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-4xl font-extrabold" style={{ color: TONE[risk.label] }}>
              {risk.score}% <span className="text-lg font-semibold">{risk.label} Risk</span>
            </p>
            {[
              ["Drought risk", risk.drought],
              ["Flood risk", risk.flood],
              ["Heat stress", risk.heat],
            ].map(([label, value]) => (
              <div key={label as string}>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>{label}</span>
                  <span>{value}%</span>
                </div>
                <Progress value={value as number} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {risk.recommendations.map((r) => (
              <p key={r} className="rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
                {r}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Metric({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
