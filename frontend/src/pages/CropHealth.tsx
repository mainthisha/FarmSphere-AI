import { useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, Loader2, MapPinned, ScanLine, Upload } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useFarmData } from "@/hooks/useFarm";
import { scanStats, useDiseaseScans, useSaveScan } from "@/hooks/useIntel";
import { analyseSeverity, mapAffectedArea, nearbyOutbreaks, predictProgression, RISK_TONE } from "@/lib/disease-intel";
import { requestDiseaseDetection } from "@/lib/api";

type Diagnosis = {
  disease: string;
  confidence: number;
  severity?: string;
  healthy?: boolean;
  symptoms?: string[];
  treatment?: string[];
  prevention?: string[];
};

const CELL_COLOR = {
  healthy: "var(--success)",
  moderate: "var(--warning)",
  severe: "var(--danger)",
} as const;

export default function CropHealthPage() {
  const { data } = useFarmData();
  const scans = useDiseaseScans();
  const saveScan = useSaveScan();
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Diagnosis | null>(null);
  const [scanKey, setScanKey] = useState("scan");
  const fileRef = useRef<HTMLInputElement>(null);

  const severity = result ? analyseSeverity(result) : null;
  const progression = severity ? predictProgression(severity.severityPct, severity.risk) : null;
  const areaMap = severity ? mapAffectedArea(severity.severityPct, scanKey) : null;
  const stats = scanStats(scans.data ?? []);
  const outbreaks = useMemo(
    () => nearbyOutbreaks(data?.farm?.location ?? "Tamil Nadu", data?.farm?.current_crop),
    [data?.farm?.location, data?.farm?.current_crop],
  );

  function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB.");
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setResult(null);
    };
    reader.readAsDataURL(file);
  }

  async function analyse() {
    if (!image) return;
    setLoading(true);
    try {
      const json = await requestDiseaseDetection({
        image,
        crop: data?.farm?.current_crop ?? "unknown",
        language: data?.profile?.language ?? "en",
      });
      if (!json.result) throw new Error(json.error ?? "Detection failed");
      const diag = json.result as Diagnosis;
      const key = `${diag.disease}-${Date.now()}`;
      setScanKey(key);
      setResult(diag);
      const sev = analyseSeverity(diag);
      const area = mapAffectedArea(sev.severityPct, key);
      saveScan.mutate({
        crop: data?.farm?.current_crop ?? "Unknown",
        disease: diag.disease,
        confidence: Math.round(diag.confidence),
        severity: sev.severityPct,
        affected_area: area.affectedPct,
        risk_level: sev.risk,
        healthy: Boolean(diag.healthy),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Detection failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="Crop Health Monitoring" subtitle="AI disease intelligence: detection, severity, spread and outbreaks">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Upload crop image</CardTitle>
            <CardDescription>Clear close-up of the affected leaf or plant works best.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid w-full place-items-center rounded-xl border-2 border-dashed border-border p-6 transition-colors hover:border-primary/60"
            >
              {image ? (
                <img src={image} alt="Uploaded crop" className="max-h-72 rounded-lg object-contain" />
              ) : (
                <span className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <Upload className="size-6" />
                  Click to select a photo (max 5 MB)
                </span>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <div className="flex gap-2">
              <Button className="flex-1 gap-2" disabled={!image || loading} onClick={analyse}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
                Detect disease
              </Button>
              {image ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setImage(null);
                    setResult(null);
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Diagnosis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!result || !severity ? (
              <p className="text-muted-foreground">
                {loading ? "Analysing the image…" : "Upload a photo and run detection to see results."}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold">{result.disease}</p>
                    <p className="text-xs text-muted-foreground">
                      {result.healthy ? "Crop appears healthy" : "Detected condition"}
                    </p>
                  </div>
                  {result.severity ? <Badge variant="secondary">{result.severity} severity</Badge> : null}
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Confidence</span>
                    <span>{Math.round(result.confidence)}%</span>
                  </div>
                  <Progress value={result.confidence} />
                </div>
                <div className="grid grid-cols-3 gap-3 rounded-xl border border-border p-3">
                  <Metric label="Severity" value={`${severity.severityPct}%`} color={RISK_TONE[severity.risk]} />
                  <Metric label="Status" value={severity.infectionLevel} />
                  <Metric label="Risk" value={severity.risk} color={RISK_TONE[severity.risk]} />
                </div>
                <Section title="Symptoms" items={result.symptoms} />
                <Section title="Solution / treatment" items={result.treatment} />
                <Section title="Prevention" items={result.prevention} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {result && severity && progression && areaMap ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Disease progression prediction</CardTitle>
              <CardDescription>
                Risk trend: <span style={{ color: RISK_TONE[severity.risk] }}>{progression.trend}</span> · about{" "}
                {progression.dailyRate}% more canopy per day
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {progression.points.map((p) => (
                  <div key={p.label} className="rounded-xl border border-border p-3">
                    <p className="text-xs text-muted-foreground">{p.label}</p>
                    <p className="text-xl font-bold">{p.infection}%</p>
                    <Progress value={p.infection} className="mt-2" />
                  </div>
                ))}
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progression.points}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="infection" name="Infection %" stroke="var(--danger)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Affected area detection</CardTitle>
              <CardDescription>Heatmap overlay of infected regions on the scanned sample.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border border-border">
                {image ? <img src={image} alt="Scanned crop" className="h-64 w-full object-cover" /> : null}
                <div
                  className="absolute inset-0 grid"
                  style={{ gridTemplateColumns: `repeat(${areaMap.cols}, minmax(0, 1fr))` }}
                >
                  {areaMap.grid.map((cell, i) => (
                    <span
                      key={i}
                      className="aspect-square"
                      style={{ background: CELL_COLOR[cell], opacity: cell === "healthy" ? 0.12 : cell === "moderate" ? 0.35 : 0.5 }}
                    />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Metric label="Affected area" value={`${areaMap.affectedPct}%`} color="var(--danger)" />
                <Metric label="Healthy area" value={`${areaMap.healthyPct}%`} color="var(--success)" />
                <Metric label="Highly affected" value={`${areaMap.severePct}%`} color="var(--warning)" />
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {(["healthy", "moderate", "severe"] as const).map((k) => (
                  <span key={k} className="flex items-center gap-1.5">
                    <span className="size-3 rounded-sm" style={{ background: CELL_COLOR[k] }} />
                    {k === "healthy" ? "Healthy regions" : k === "moderate" ? "Moderately affected" : "Highly affected"}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4" /> Disease intelligence dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
              <Metric label="Total scans" value={String(stats.total)} big />
              <Metric label="Active disease cases" value={String(stats.active)} big color="var(--warning)" />
              <Metric label="Critical cases" value={String(stats.critical)} big color="var(--danger)" />
              <Metric label="Most common disease" value={stats.common} big />
            </div>
            <div className="h-52 lg:col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.weekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="scans" name="Scans" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="cases" name="Disease cases" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPinned className="size-4" /> Nearby outbreak alerts
          </CardTitle>
          <CardDescription>
            Regional surveillance around {data?.farm?.location || "your district"} (demo surveillance feed).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {outbreaks.map((o) => (
            <div key={o.disease} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    {o.risk === "High" ? <AlertTriangle className="size-4" style={{ color: RISK_TONE.High }} /> : null}
                    {o.disease}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.reports} nearby reports · {o.region} · {o.distanceKm} km away · {o.crop}
                  </p>
                </div>
                <Badge variant="secondary" style={{ color: RISK_TONE[o.risk] }}>
                  {o.risk} risk
                </Badge>
              </div>
              <div className="mt-3 h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={o.trend}>
                    <XAxis dataKey="week" hide />
                    <YAxis hide />
                    <Tooltip />
                    <Line type="monotone" dataKey="cases" name="Cases" stroke={RISK_TONE[o.risk]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Metric({ label, value, color, big }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <div className={big ? "rounded-xl border border-border p-4" : undefined}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={big ? "text-2xl font-bold" : "font-semibold"} style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}

function Section({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 font-medium">{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
