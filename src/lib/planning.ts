import { supabase } from "@/integrations/supabase/client";

export type StrategicGoal = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  area_slug: string | null;
  quarter: string;
  target_value: number | null;
  current_value: number;
  status: "active" | "completed" | "abandoned";
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type ScheduledQuest = {
  id: string;
  user_id: string;
  scheduled_date: string; // YYYY-MM-DD
  title: string;
  subtitle: string | null;
  area_slug: string | null;
  goal_id: string | null;
  xp_reward: number;
  status: "planned" | "done" | "skipped";
  created_at: string;
  updated_at: string;
};

export type CalendarDay = { day: string; xp: number; events: number };

export function currentQuarter(d = new Date()): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

export function quarterRange(quarter: string): { start: Date; end: Date } {
  const [yearStr, qStr] = quarter.split("-Q");
  const year = Number(yearStr);
  const q = Number(qStr);
  const startMonth = (q - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return { start, end };
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ============ Strategic Goals ============

export async function listGoals(userId: string, quarter?: string): Promise<StrategicGoal[]> {
  let q = supabase
    .from("strategic_goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (quarter) q = q.eq("quarter", quarter);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as StrategicGoal[];
}

export async function createGoal(input: {
  user_id: string;
  title: string;
  description?: string | null;
  area_slug?: string | null;
  quarter: string;
  target_value?: number;
}): Promise<StrategicGoal> {
  const { data, error } = await supabase
    .from("strategic_goals")
    .insert({
      user_id: input.user_id,
      title: input.title,
      description: input.description ?? null,
      area_slug: input.area_slug ?? null,
      quarter: input.quarter,
      target_value: input.target_value ?? 1,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as StrategicGoal;
}

export async function updateGoal(
  id: string,
  patch: Partial<Pick<StrategicGoal, "title" | "description" | "current_value" | "target_value" | "status">>,
): Promise<StrategicGoal> {
  const body: Partial<StrategicGoal> = { ...patch };
  if (patch.status === "completed") body.completed_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("strategic_goals")
    .update(body)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as StrategicGoal;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from("strategic_goals").delete().eq("id", id);
  if (error) throw error;
}

// ============ Scheduled Quests ============

export async function listScheduled(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<ScheduledQuest[]> {
  const { data, error } = await supabase
    .from("scheduled_quests")
    .select("*")
    .eq("user_id", userId)
    .gte("scheduled_date", isoDate(startDate))
    .lte("scheduled_date", isoDate(endDate))
    .order("scheduled_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ScheduledQuest[];
}

export async function createScheduled(input: {
  user_id: string;
  scheduled_date: Date | string;
  title: string;
  subtitle?: string | null;
  area_slug?: string | null;
  goal_id?: string | null;
  xp_reward?: number;
}): Promise<ScheduledQuest> {
  const date =
    typeof input.scheduled_date === "string" ? input.scheduled_date : isoDate(input.scheduled_date);
  const { data, error } = await supabase
    .from("scheduled_quests")
    .insert({
      user_id: input.user_id,
      scheduled_date: date,
      title: input.title,
      subtitle: input.subtitle ?? null,
      area_slug: input.area_slug ?? null,
      goal_id: input.goal_id ?? null,
      xp_reward: input.xp_reward ?? 50,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ScheduledQuest;
}

export async function updateScheduledStatus(
  id: string,
  status: ScheduledQuest["status"],
): Promise<ScheduledQuest> {
  const { data, error } = await supabase
    .from("scheduled_quests")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ScheduledQuest;
}

export async function deleteScheduled(id: string): Promise<void> {
  const { error } = await supabase.from("scheduled_quests").delete().eq("id", id);
  if (error) throw error;
}

// ============ Calendar activity (heatmap) ============

export async function calendarActivity(start: Date, end: Date): Promise<CalendarDay[]> {
  const { data, error } = await supabase.rpc("calendar_activity", {
    _start: isoDate(start),
    _end: isoDate(end),
  });
  if (error) throw error;
  return (data ?? []) as CalendarDay[];
}

// ============ Month helpers ============

export function monthMatrix(year: number, month: number): Date[][] {
  // month is 0-indexed; returns 6 rows × 7 cols starting Monday
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(year, month, 1 - startOffset);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d));
    }
    weeks.push(row);
  }
  return weeks;
}

export function dateKey(d: Date): string {
  return isoDate(d);
}
