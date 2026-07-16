import { supabase } from "@/integrations/supabase/client";

export type RitualType = "morning" | "night";

export type NotificationPrefs = {
  morning_hour: number;
  night_hour: number;
  push_enabled: boolean;
  /** IANA — as janelas de dump são calculadas no servidor, que precisa saber o fuso. */
  timezone: string;
};

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export type RitualLog = {
  id: string;
  ritual_date: string;
  ritual_type: RitualType;
  intention: string | null;
  reflections: Record<string, string>;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const { data } = await supabase
    .from("notification_prefs")
    .select("morning_hour, night_hour, push_enabled, timezone")
    .eq("user_id", userId)
    .maybeSingle();
  return (
    (data as NotificationPrefs) ?? {
      morning_hour: 7,
      night_hour: 22,
      push_enabled: false,
      timezone: browserTimezone(),
    }
  );
}

/**
 * Mantém o fuso salvo em dia — quem gera o push é o servidor, então um fuso
 * errado manda o "bom dia" na hora errada. Silencioso: nunca bloqueia a tela.
 */
export async function syncTimezone(userId: string, saved: string | null | undefined) {
  const tz = browserTimezone();
  if (!tz || tz === saved) return;
  try {
    await supabase
      .from("notification_prefs")
      .upsert({ user_id: userId, timezone: tz }, { onConflict: "user_id" });
  } catch {
    /* fuso desatualizado não justifica quebrar a home */
  }
}

export async function saveNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs,
): Promise<void> {
  const { error } = await supabase
    .from("notification_prefs")
    .upsert({ user_id: userId, ...prefs }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function getTodayRituals(userId: string): Promise<{
  morning: RitualLog | null;
  night: RitualLog | null;
}> {
  const { data } = await supabase
    .from("ritual_logs")
    .select("id, ritual_date, ritual_type, intention, reflections")
    .eq("user_id", userId)
    .eq("ritual_date", todayISO());
  const rows = (data ?? []) as RitualLog[];
  return {
    morning: rows.find((r) => r.ritual_type === "morning") ?? null,
    night: rows.find((r) => r.ritual_type === "night") ?? null,
  };
}

export async function saveRitual(
  userId: string,
  type: RitualType,
  payload: { intention?: string; reflections?: Record<string, string> },
): Promise<RitualLog> {
  const row = {
    user_id: userId,
    ritual_date: todayISO(),
    ritual_type: type,
    intention: payload.intention ?? null,
    reflections: payload.reflections ?? {},
  };
  const { data, error } = await supabase
    .from("ritual_logs")
    .upsert(row, { onConflict: "user_id,ritual_date,ritual_type" })
    .select("id, ritual_date, ritual_type, intention, reflections")
    .single();
  if (error) throw error;
  return data as RitualLog;
}
