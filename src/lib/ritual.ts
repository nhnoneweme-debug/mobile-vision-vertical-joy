import { supabase } from "@/integrations/supabase/client";

export type RitualType = "morning" | "night";

export type NotificationPrefs = {
  morning_hour: number;
  night_hour: number;
  push_enabled: boolean;
};

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
    .select("morning_hour, night_hour, push_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  return (
    (data as NotificationPrefs) ?? {
      morning_hour: 7,
      night_hour: 22,
      push_enabled: false,
    }
  );
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
    .insert(row)
    .select("id, ritual_date, ritual_type, intention, reflections")
    .single();
  if (error) throw error;
  return data as RitualLog;
}
