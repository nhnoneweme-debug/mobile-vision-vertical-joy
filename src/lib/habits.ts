import { supabase } from "@/integrations/supabase/client";
import type { BehavioralClass } from "./behavior";

export type HabitFrequency = "daily" | "weekly" | "monthly";

export type HabitRow = {
  id: string;
  user_id: string;
  title: string;
  icon: string;
  area_slug: string;
  target_per_week: number;
  frequency?: HabitFrequency | null; // novo — pode faltar em hábitos antigos
  target?: number | null; // meta por período (dia/semana/mês)
  active: boolean;
  pinned_at?: string | null; // fixado na Home; NULL = não fixado
  created_at: string;
  updated_at: string;
};

export type HabitWithMeta = HabitRow & {
  done_today: boolean;
  log_id: string | null;
  streak: number;
  week_done: number; // compat
  // Novo — orientado a período:
  freq: HabitFrequency;
  period_done: number;
  period_target: number;
  resets_in: string; // rótulo curto: "reinicia à meia-noite", "reinicia seg", etc.
};

export const FREQUENCY_META: Record<HabitFrequency, { label: string; short: string }> = {
  daily: { label: "Diário", short: "DIA" },
  weekly: { label: "Semanal", short: "SEM" },
  monthly: { label: "Mensal", short: "MÊS" },
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayISO(): string {
  return fmt(new Date());
}
function weekStartISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday as start
  d.setDate(d.getDate() + diff);
  return fmt(d);
}
function monthStartISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

/** Frequência efetiva de um hábito (default: weekly, para compat com antigos). */
export function habitFreq(h: { frequency?: HabitFrequency | null }): HabitFrequency {
  return h.frequency ?? "weekly";
}
/** Meta por período (default: por semana = target_per_week; diário = 1). */
export function habitTarget(h: {
  frequency?: HabitFrequency | null;
  target?: number | null;
  target_per_week?: number;
}): number {
  const f = habitFreq(h);
  if (f === "daily") return Math.max(1, h.target ?? 1);
  if (f === "weekly") {
    // Para semanais, target_per_week é a fonte da verdade (hábitos antigos
    // tiveram `target` back-fillado com 1 pela migration); usamos o maior.
    return Math.max(1, h.target_per_week ?? 0, h.target ?? 0, 1);
  }
  // monthly
  return Math.max(1, h.target ?? 0, h.target_per_week ?? 0, 1);
}

function periodStartISO(f: HabitFrequency): string {
  return f === "daily" ? todayISO() : f === "weekly" ? weekStartISO() : monthStartISO();
}
/** Rótulo "reinicia em…" conforme a frequência. */
export function resetsInLabel(f: HabitFrequency): string {
  const now = new Date();
  if (f === "daily") return "reinicia à meia-noite";
  if (f === "weekly") {
    const daysToMon = (8 - (now.getDay() || 7)) % 7 || 7; // dias até próxima segunda
    return daysToMon === 1 ? "reinicia amanhã" : `reinicia em ${daysToMon}d`;
  }
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const days = Math.ceil((first.getTime() - now.getTime()) / 864e5);
  return `reinicia em ${days}d`;
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
  const monthStart = monthStartISO(); // janela mais ampla (cobre dia/semana/mês)
  const ids = habits.map((h) => h.id);

  const { data: logs } = await supabase
    .from("habit_logs")
    .select("id, habit_id, log_date")
    .in("habit_id", ids)
    .gte("log_date", monthStart);

  const streaks = await Promise.all(
    ids.map((id) => supabase.rpc("habit_streak", { _habit_id: id })),
  );

  return habits.map((h, idx) => {
    const freq = habitFreq(h as HabitRow);
    const pStart = periodStartISO(freq);
    const hlogs = (logs ?? []).filter((l) => l.habit_id === h.id);
    const periodLogs = hlogs.filter((l) => (l.log_date ?? "") >= pStart);
    const todayLog = hlogs.find((l) => l.log_date === today);
    return {
      ...(h as HabitRow),
      done_today: Boolean(todayLog),
      log_id: todayLog?.id ?? null,
      streak: (streaks[idx]?.data as number | null) ?? 0,
      week_done: hlogs.filter((l) => (l.log_date ?? "") >= weekStartISO()).length,
      freq,
      period_done: periodLogs.length,
      period_target: habitTarget(h as HabitRow),
      resets_in: resetsInLabel(freq),
    };
  });
}

export async function toggleHabit(habit: HabitWithMeta, userId: string): Promise<void> {
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
  supabase.rpc("check_perk_unlocks").then(
    () => {},
    () => {},
  );
}

/**
 * Registra +1 conclusão do hábito no PERÍODO atual (dia/semana/mês conforme a
 * frequência), respeitando o teto (period_target). Retorna false se já atingiu
 * o máximo. Grava o log numa data dentro do período (espalha para não colidir).
 */
export async function incrementHabit(userId: string, habit: HabitWithMeta): Promise<boolean> {
  const target = Math.max(1, habit.period_target || habitTarget(habit));
  if (habit.period_done >= target) return false;

  const freq = habit.freq ?? habitFreq(habit);
  const start = new Date(`${periodStartISO(freq)}T00:00:00`);
  if (freq === "weekly") start.setDate(start.getDate() + Math.min(6, habit.period_done));
  else if (freq === "monthly") start.setDate(start.getDate() + Math.min(27, habit.period_done));
  // daily: mesmo dia (mock conta múltiplos logs no dia)
  const log_date = fmt(start);

  const { error } = await supabase.from("habit_logs").insert({
    habit_id: habit.id,
    user_id: userId,
    log_date,
    status: "completed",
  });
  if (error) throw error;
  supabase.rpc("check_perk_unlocks").then(
    () => {},
    () => {},
  );
  return true;
}

/**
 * Desfaz +1 conclusão do hábito no PERÍODO atual (corrige marcação por engano).
 * Remove o log mais recente do período. Retorna false se não houver nada a desfazer.
 */
export async function decrementHabit(userId: string, habit: HabitWithMeta): Promise<boolean> {
  const freq = habit.freq ?? habitFreq(habit);
  const pStart = periodStartISO(freq);
  const { data: logs, error } = await supabase
    .from("habit_logs")
    .select("id, log_date")
    .eq("habit_id", habit.id)
    .eq("user_id", userId)
    .gte("log_date", pStart)
    .order("log_date", { ascending: false });
  if (error) throw error;
  if (!logs || logs.length === 0) return false;

  const { error: delErr } = await supabase
    .from("habit_logs")
    .delete()
    .eq("id", (logs[0] as { id: string }).id);
  if (delErr) throw delErr;
  return true;
}

export async function createHabit(
  userId: string,
  input: {
    title: string;
    icon?: string;
    area_slug?: string;
    target_per_week?: number;
    frequency?: HabitFrequency;
    target?: number;
  },
): Promise<HabitRow> {
  const frequency = input.frequency ?? "weekly";
  const target =
    input.target ??
    (frequency === "daily" ? 1 : frequency === "monthly" ? 1 : (input.target_per_week ?? 7));
  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: userId,
      title: input.title.trim().slice(0, 60),
      icon: input.icon ?? "flame",
      area_slug: input.area_slug ?? "corpo",
      frequency,
      target,
      target_per_week: frequency === "weekly" ? target : (input.target_per_week ?? 7),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as HabitRow;
}

export async function archiveHabit(id: string): Promise<void> {
  // Arquivar solta o pin: um hábito arquivado não pode ocupar vaga na Home.
  const { error } = await supabase
    .from("habits")
    .update({ active: false, pinned_at: null })
    .eq("id", id);
  if (error) throw error;
}

// --- Fixar na Home ---------------------------------------------------------

/** Quantos hábitos cabem na Home. */
export const MAX_PINNED = 7;

const legacyPinKey = (userId: string) => `habits.pinned.${userId}`;

export function isPinned(h: Pick<HabitRow, "pinned_at">): boolean {
  return !!h.pinned_at;
}

/** Fixados primeiro (na ordem em que foram fixados); o resto mantém a ordem de criação. */
export function sortByPin<T extends Pick<HabitRow, "pinned_at">>(habits: T[]): T[] {
  return [...habits].sort((a, b) => {
    if (!a.pinned_at && !b.pinned_at) return 0;
    if (!a.pinned_at) return 1;
    if (!b.pinned_at) return -1;
    return a.pinned_at.localeCompare(b.pinned_at);
  });
}

/** O que a Home mostra: os fixados, ou os primeiros N se ninguém fixou nada. */
export function homeHabits<T extends Pick<HabitRow, "pinned_at">>(habits: T[]): T[] {
  const pinned = sortByPin(habits.filter((h) => h.pinned_at));
  return (pinned.length > 0 ? pinned : habits).slice(0, MAX_PINNED);
}

export async function setHabitPinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase
    .from("habits")
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Migra os pins que ficaram no localStorage antes deles existirem no banco.
 *
 * Roda uma vez: só age se o usuário ainda não tem nenhum pinned_at, pra não
 * sobrescrever escolhas novas com o resíduo de um dispositivo antigo. A chave
 * local é apagada em qualquer caso — inclusive quando não há o que migrar.
 */
export async function migrateLegacyPins(userId: string, habits: HabitRow[]): Promise<boolean> {
  let ids: string[] = [];
  try {
    const raw = localStorage.getItem(legacyPinKey(userId));
    if (!raw) return false;
    ids = JSON.parse(raw) as string[];
  } catch {
    return false;
  }

  const jaTemNoBanco = habits.some((h) => h.pinned_at);
  const validos = ids.filter((id) => habits.some((h) => h.id === id)).slice(0, MAX_PINNED);

  if (jaTemNoBanco || validos.length === 0) {
    try {
      localStorage.removeItem(legacyPinKey(userId));
    } catch {
      /* noop */
    }
    return false;
  }

  // Preserva a ordem original do array local como ordem de fixação.
  const base = Date.now();
  await Promise.all(
    validos.map((id, i) =>
      supabase
        .from("habits")
        .update({ pinned_at: new Date(base + i).toISOString() })
        .eq("id", id)
        .eq("user_id", userId),
    ),
  );
  try {
    localStorage.removeItem(legacyPinKey(userId));
  } catch {
    /* noop */
  }
  return true;
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
  const seeds = SEED_BY_CLASS[klass as BehavioralClass] ?? SEED_BY_CLASS.executor;
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
