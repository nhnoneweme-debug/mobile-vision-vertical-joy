import { supabase } from "@/integrations/supabase/client";
import type { BehavioralClass } from "./behavior";

export type HabitRow = {
  id: string;
  user_id: string;
  title: string;
  icon: string;
  area_slug: string;
  target_per_week: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type HabitWithMeta = HabitRow & {
  done_today: boolean;
  log_id: string | null;
  streak: number;
  week_done: number;
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekStartISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday as start
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function listHabits(userId: string): Promise<HabitWithMeta[]> {
  const { data: habits, error } = await supabase
    .from("habits")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!habits || habits.length === 0) return [];

  const today = todayISO();
  const wstart = weekStartISO();
  const ids = habits.map((h) => h.id);

  const { data: logs } = await supabase
    .from("habit_logs")
    .select("id, habit_id, log_date")
    .in("habit_id", ids)
    .gte("log_date", wstart);

  const streaks = await Promise.all(
    ids.map((id) => supabase.rpc("habit_streak", { _habit_id: id })),
  );

  return habits.map((h, idx) => {
    const hlogs = (logs ?? []).filter((l) => l.habit_id === h.id);
    const todayLog = hlogs.find((l) => l.log_date === today);
    return {
      ...(h as HabitRow),
      done_today: Boolean(todayLog),
      log_id: todayLog?.id ?? null,
      streak: (streaks[idx]?.data as number | null) ?? 0,
      week_done: hlogs.length,
    };
  });
}

export async function toggleHabit(
  habit: HabitWithMeta,
  userId: string,
): Promise<void> {
  if (habit.done_today && habit.log_id) {
    const { error } = await supabase.from("habit_logs").delete().eq("id", habit.log_id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("habit_logs").insert({
    habit_id: habit.id,
    user_id: userId,
    log_date: todayISO(),
    status: "completed",
  });
  if (error) throw error;
  supabase.rpc("check_perk_unlocks").then(() => {}, () => {});
}

export async function createHabit(
  userId: string,
  input: { title: string; icon?: string; area_slug?: string; target_per_week?: number },
): Promise<HabitRow> {
  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: userId,
      title: input.title.trim().slice(0, 60),
      icon: input.icon ?? "flame",
      area_slug: input.area_slug ?? "corpo",
      target_per_week: input.target_per_week ?? 7,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as HabitRow;
}

export async function archiveHabit(id: string): Promise<void> {
  const { error } = await supabase.from("habits").update({ active: false }).eq("id", id);
  if (error) throw error;
}

type SeedHabit = { title: string; icon: string; area_slug: string; target_per_week: number };

const SEED_BY_CLASS: Record<BehavioralClass, SeedHabit[]> = {
  executor: [
    { title: "10 min de foco profundo", icon: "zap", area_slug: "mental", target_per_week: 7 },
    { title: "Mover o corpo (20 min)", icon: "dumbbell", area_slug: "treino", target_per_week: 5 },
    { title: "Beber 2L de água", icon: "droplet", area_slug: "cozinha", target_per_week: 7 },
  ],
  estrategista: [
    { title: "Planejar o dia (5 min)", icon: "clipboard", area_slug: "mental", target_per_week: 7 },
    { title: "Treino programado", icon: "dumbbell", area_slug: "treino", target_per_week: 4 },
    { title: "Refeição registrada", icon: "utensils", area_slug: "cozinha", target_per_week: 7 },
  ],
  explorador: [
    { title: "Movimento novo do dia", icon: "sparkles", area_slug: "treino", target_per_week: 5 },
    { title: "Caminhada ao ar livre", icon: "trees", area_slug: "corpo", target_per_week: 5 },
    { title: "Leitura 10 min", icon: "book", area_slug: "mental", target_per_week: 5 },
  ],
  guardiao: [
    { title: "Dormir antes da meia-noite", icon: "moon", area_slug: "quarto", target_per_week: 7 },
    { title: "Alongar 10 min", icon: "heart", area_slug: "corpo", target_per_week: 7 },
    { title: "Beber 2L de água", icon: "droplet", area_slug: "cozinha", target_per_week: 7 },
  ],
  visionario: [
    { title: "Reflexão diária (3 min)", icon: "sparkles", area_slug: "mental", target_per_week: 7 },
    { title: "Treino consciente", icon: "dumbbell", area_slug: "treino", target_per_week: 4 },
    { title: "Visualizar o eu futuro", icon: "eye", area_slug: "mental", target_per_week: 5 },
  ],
};

export async function seedHabitsForClass(
  userId: string,
  klass: BehavioralClass | string,
): Promise<void> {
  const seeds = SEED_BY_CLASS[(klass as BehavioralClass)] ?? SEED_BY_CLASS.executor;
  const { data: existing } = await supabase
    .from("habits")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  if (existing && existing.length > 0) return;
  const rows = seeds.map((s) => ({ user_id: userId, ...s }));
  const { error } = await supabase.from("habits").insert(rows);
  if (error) throw error;
}

export async function monthlyHabitProgress(
  userId: string,
  year: number,
  month: number, // 0-indexed
): Promise<{ done: number; target: number; pct: number }> {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const startISO = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endISO = `${year}-${String(month + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  const daysInMonth = end.getDate();

  const { data: habits, error } = await supabase
    .from("habits")
    .select("id, target_per_week")
    .eq("user_id", userId)
    .eq("active", true);
  if (error) throw error;
  if (!habits || habits.length === 0) return { done: 0, target: 0, pct: 0 };

  const weeks = daysInMonth / 7;
  const target = Math.max(
    0,
    Math.round(habits.reduce((s, h) => s + (h.target_per_week ?? 0) * weeks, 0)),
  );

  const ids = habits.map((h) => h.id);
  const { data: logs, error: logsErr } = await supabase
    .from("habit_logs")
    .select("id")
    .in("habit_id", ids)
    .gte("log_date", startISO)
    .lte("log_date", endISO);
  if (logsErr) throw logsErr;

  const done = logs?.length ?? 0;
  const pct = target > 0 ? Math.max(0, Math.min(100, Math.round((done / target) * 100))) : 0;
  // silence unused start
  void start;
  return { done, target, pct };
}
