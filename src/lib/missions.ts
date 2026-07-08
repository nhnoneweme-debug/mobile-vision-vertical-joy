import { supabase } from "@/integrations/supabase/client";

export type MissionType = "daily" | "weekly" | "one_off";

export type UserMission = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  area_slug: string | null;
  mission_type: MissionType;
  scheduled_time: string | null; // "HH:MM:SS" (início)
  end_time?: string | null; // "HH:MM" (fim, opcional)
  weekday_mask: number; // bitmask, Sun=1,Mon=2,...,Sat=64. 127 = all week
  remind_before_min: number;
  xp_reward: number;
  active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserMissionWithMeta = UserMission & {
  done_today: boolean;
  log_id: string | null;
  week_done: number;
};

export type MissionInput = {
  title: string;
  notes?: string;
  area_slug?: string | null;
  mission_type?: MissionType;
  scheduled_time?: string | null;
  end_time?: string | null;
  weekday_mask?: number;
  remind_before_min?: number;
  xp_reward?: number;
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekStartISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isScheduledToday(m: Pick<UserMission, "mission_type" | "weekday_mask">): boolean {
  if (m.mission_type === "one_off") return true;
  const dayBit = 1 << new Date().getDay();
  return (m.weekday_mask & dayBit) !== 0;
}

export async function listMissions(userId: string): Promise<UserMissionWithMeta[]> {
  const { data, error } = await supabase
    .from("user_missions")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .is("archived_at", null)
    .order("scheduled_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  const missions = (data ?? []) as UserMission[];
  if (missions.length === 0) return [];

  const today = todayISO();
  const wstart = weekStartISO();
  const ids = missions.map((m) => m.id);

  const { data: logs } = await supabase
    .from("user_mission_logs")
    .select("id, mission_id, log_date, done")
    .in("mission_id", ids)
    .gte("log_date", wstart);

  return missions.map((m) => {
    const mlogs = (logs ?? []).filter((l) => l.mission_id === m.id && l.done);
    const todayLog = mlogs.find((l) => l.log_date === today);
    return {
      ...m,
      done_today: Boolean(todayLog),
      log_id: todayLog?.id ?? null,
      week_done: mlogs.length,
    };
  });
}

export async function toggleMissionToday(
  m: UserMissionWithMeta,
  userId: string,
): Promise<void> {
  if (m.done_today && m.log_id) {
    const { error } = await supabase.from("user_mission_logs").delete().eq("id", m.log_id);
    if (error) throw error;
    // Roll back XP awarded by the trigger
    await supabase.rpc("check_perk_unlocks").then(() => {}, () => {});
    return;
  }
  const { error } = await supabase.from("user_mission_logs").insert({
    user_id: userId,
    mission_id: m.id,
    log_date: todayISO(),
    done: true,
  });
  if (error) throw error;
  supabase.rpc("check_perk_unlocks").then(() => {}, () => {});
}

export async function createMission(userId: string, input: MissionInput): Promise<UserMission> {
  const payload = {
    user_id: userId,
    title: input.title.trim().slice(0, 140),
    notes: input.notes?.trim().slice(0, 2000) || null,
    area_slug: input.area_slug ?? null,
    mission_type: input.mission_type ?? "daily",
    scheduled_time: input.scheduled_time || null,
    end_time: input.end_time || null,
    weekday_mask: input.weekday_mask ?? 127,
    remind_before_min: input.remind_before_min ?? 0,
    xp_reward: input.xp_reward ?? 15,
  };
  const { data, error } = await supabase
    .from("user_missions")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as UserMission;
}

export async function updateMission(id: string, patch: Partial<MissionInput> & { active?: boolean }): Promise<void> {
  const clean = { ...patch } as Partial<MissionInput> & { active?: boolean };
  if (typeof clean.title === "string") clean.title = clean.title.trim().slice(0, 140);
  if (typeof clean.notes === "string") clean.notes = clean.notes.trim().slice(0, 2000) || undefined;
  const { error } = await supabase.from("user_missions").update(clean).eq("id", id);
  if (error) throw error;
}

export async function archiveMission(id: string): Promise<void> {
  const { error } = await supabase
    .from("user_missions")
    .update({ active: false, archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function duplicateMission(m: UserMission, userId: string): Promise<UserMission> {
  return createMission(userId, {
    title: `${m.title} (cópia)`,
    notes: m.notes ?? undefined,
    area_slug: m.area_slug,
    mission_type: m.mission_type,
    scheduled_time: m.scheduled_time,
    weekday_mask: m.weekday_mask,
    remind_before_min: m.remind_before_min,
    xp_reward: m.xp_reward,
  });
}

// ─── Presets rápidos por área ───────────────────────────────────────────────
export type MissionPreset = {
  area_slug: string;
  title: string;
  mission_type: MissionType;
  scheduled_time?: string;
  weekday_mask?: number;
  xp_reward: number;
  notes?: string;
};

export const MISSION_PRESETS: MissionPreset[] = [
  // Treino
  { area_slug: "treino", title: "Treino de força", mission_type: "weekly", weekday_mask: 42 /* Mon+Wed+Fri */, scheduled_time: "18:00", xp_reward: 25 },
  { area_slug: "treino", title: "Mobilidade 10 min", mission_type: "daily", scheduled_time: "07:30", xp_reward: 10 },
  { area_slug: "treino", title: "Cardio leve 20 min", mission_type: "weekly", weekday_mask: 84 /* Tue+Thu+Sat */, scheduled_time: "07:00", xp_reward: 15 },
  { area_slug: "treino", title: "Progressão de carga (registro)", mission_type: "weekly", weekday_mask: 42, xp_reward: 20, notes: "Anote peso/repetições dos exercícios principais." },
  // Cozinha
  { area_slug: "cozinha", title: "Beber 2L de água", mission_type: "daily", xp_reward: 10 },
  { area_slug: "cozinha", title: "Registrar refeição", mission_type: "daily", scheduled_time: "13:00", xp_reward: 10 },
  // Quarto (rituais de sono)
  { area_slug: "quarto", title: "Sem tela 30 min antes de dormir", mission_type: "daily", scheduled_time: "22:30", xp_reward: 15 },
  { area_slug: "quarto", title: "Copo d'água antes de dormir", mission_type: "daily", scheduled_time: "22:45", xp_reward: 5 },
  { area_slug: "quarto", title: "Respiração 4-7-8 (3 ciclos)", mission_type: "daily", scheduled_time: "22:50", xp_reward: 10 },
  // Mental
  { area_slug: "mental", title: "Reflexão 3 min", mission_type: "daily", scheduled_time: "21:00", xp_reward: 10 },
];

// ─── Weekday mask helpers ───────────────────────────────────────────────────
export const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"] as const;
export const WEEKDAY_FULL = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

export function maskToDays(mask: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (mask & (1 << i) ? i : -1)).filter((i) => i >= 0);
}
export function toggleDay(mask: number, dayIdx: number): number {
  return mask ^ (1 << dayIdx);
}
export function formatMask(mask: number, type: MissionType): string {
  if (type === "one_off") return "uma vez";
  if (mask === 127) return "todos os dias";
  if (mask === 62) return "seg–sex";
  if (mask === 65) return "fim de semana";
  return maskToDays(mask).map((i) => WEEKDAY_FULL[i]).join(" · ");
}
