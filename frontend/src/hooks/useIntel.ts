import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { intelApi, type DiseaseScan, type VoiceConsultation } from "@/lib/api";

export type { DiseaseScan, VoiceConsultation };

export function useDiseaseScans() {
  return useQuery({
    queryKey: ["disease-scans"],
    queryFn: () => intelApi.listScans(),
  });
}

export function useSaveScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scan: {
      crop: string;
      disease: string;
      confidence: number;
      severity: number;
      affected_area: number;
      risk_level: string;
      healthy: boolean;
    }) => intelApi.saveScan(scan),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["disease-scans"] }),
  });
}

export function useConsultations() {
  return useQuery({
    queryKey: ["voice-consultations"],
    queryFn: () => intelApi.listConsultations(),
  });
}

export function useSaveConsultation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (row: { language: string; query: string; response: string; status: string }) =>
      intelApi.saveConsultation(row),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["voice-consultations"] }),
  });
}

/** Aggregated stats for the disease intelligence dashboard. */
export function scanStats(scans: DiseaseScan[]) {
  const active = scans.filter((s) => !s.healthy);
  const critical = active.filter((s) => Number(s.severity) >= 55);
  const counts = new Map<string, number>();
  active.forEach((s) => counts.set(s.disease, (counts.get(s.disease) ?? 0) + 1));
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const weekly = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toDateString();
    return {
      day: d.toLocaleDateString(undefined, { weekday: "short" }),
      scans: scans.filter((s) => new Date(s.created_at).toDateString() === key).length,
      cases: active.filter((s) => new Date(s.created_at).toDateString() === key).length,
    };
  });
  return {
    total: scans.length,
    active: active.length,
    critical: critical.length,
    common: common ? common[0] : "—",
    weekly,
  };
}
