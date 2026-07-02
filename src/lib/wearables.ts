import { supabase } from "@/integrations/supabase/client";

export type WearableMetric =
  | "sleep_hours"
  | "sleep_quality"
  | "steps"
  | "resting_hr"
  | "hr_avg"
  | "active_kcal";

export type WearableSource =
  | "manual"
  | "apple_health"
  | "google_fit"
  | "samsung_health"
  | "fitbit"
  | "other";

export type WearableSample = {
  date: string; // YYYY-MM-DD
  metric: WearableMetric;
  value: number;
};

export type WearableConnection = {
  source: WearableSource;
  status: string;
  last_sync_at: string | null;
  meta: Record<string, unknown> | null;
};

const METRIC_ALIASES: Record<string, WearableMetric> = {
  sleep_hours: "sleep_hours",
  sleep: "sleep_hours",
  hours_asleep: "sleep_hours",
  sleep_quality: "sleep_quality",
  quality: "sleep_quality",
  steps: "steps",
  step_count: "steps",
  resting_hr: "resting_hr",
  resting_heart_rate: "resting_hr",
  hr_avg: "hr_avg",
  heart_rate: "hr_avg",
  active_kcal: "active_kcal",
  active_energy: "active_kcal",
  calories: "active_kcal",
};

export function normalizeMetric(raw: string): WearableMetric | null {
  const k = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return METRIC_ALIASES[k] ?? null;
}

/**
 * Parses a JSON array or CSV string of the form:
 *   date,metric,value
 *   2025-11-01,sleep_hours,7.5
 * Or a JSON payload from Apple Health / Google Fit exports (best-effort).
 */
export function parseWearableFile(text: string): WearableSample[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : (parsed.samples ?? parsed.data ?? []);
      const out: WearableSample[] = [];
      for (const r of arr) {
        const metric = normalizeMetric(r.metric ?? r.type ?? r.name ?? "");
        const date = String(r.date ?? r.day ?? r.startDate ?? "").slice(0, 10);
        const value = Number(r.value ?? r.qty ?? r.total);
        if (metric && date && Number.isFinite(value)) {
          out.push({ date, metric, value });
        }
      }
      return out;
    } catch {
      return [];
    }
  }
  // CSV
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  const out: WearableSample[] = [];
  for (const line of lines) {
    const [d, m, v] = line.split(",").map((s) => s.trim());
    if (!d || !m || !v) continue;
    if (d.toLowerCase() === "date") continue; // header
    const metric = normalizeMetric(m);
    const value = Number(v);
    if (metric && Number.isFinite(value)) {
      out.push({ date: d.slice(0, 10), metric, value });
    }
  }
  return out;
}

export async function importWearableSamples(
  source: WearableSource,
  samples: WearableSample[],
): Promise<{ imported: number; sleep_synced: number }> {
  if (samples.length === 0) return { imported: 0, sleep_synced: 0 };
  const { data, error } = await supabase.rpc("import_wearable_samples", {
    _source: source,
    _samples: samples as unknown as never,
  });
  if (error) throw error;
  return data as unknown as { imported: number; sleep_synced: number };
}

export async function listConnections(): Promise<WearableConnection[]> {
  const { data, error } = await supabase
    .from("wearable_connections")
    .select("source, status, last_sync_at, meta")
    .order("last_sync_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WearableConnection[];
}

export async function listRecentSamples(days = 14) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from("wearable_samples")
    .select("sample_date, metric, value, source")
    .gte("sample_date", since.toISOString().slice(0, 10))
    .order("sample_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
