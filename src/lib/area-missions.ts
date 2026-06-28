import { supabase } from "@/integrations/supabase/client";

export type AreaMission = {
  id: string;
  area_slug: string;
  title: string;
  subtitle: string;
  xp_reward: number;
  weekly_target: number;
  class_affinity: string[];
  sort_order: number;
};

export type AreaMissionWithMeta = AreaMission & {
  week_done: number; // completions this week
  last_log_id: string | null; // most recent log id (for quick undo)
  affinity_match: boolean;
};

export type AreaProgress = {
  area_slug: string;
  level: number;
  xp: number;
};

function weekStartISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function listAreaMissions(
  areaSlug: string,
  userId: string,
  klass: string | null,
): Promise<{ missions: AreaMissionWithMeta[]; progress: AreaProgress }> {
  const { data: missions, error } = await supabase
    .from("area_missions")
    .select("*")
    .eq("area_slug", areaSlug)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;

  const ids = (missions ?? []).map((m) => m.id);
  const since = weekStartISO();

  const [{ data: logs }, { data: progRow }] = await Promise.all([
    ids.length
      ? supabase
          .from("area_mission_logs")
          .select("id, mission_id, completed_at")
          .eq("user_id", userId)
          .in("mission_id", ids)
          .gte("completed_at", since)
          .order("completed_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; mission_id: string; completed_at: string }[] }),
    supabase
      .from("area_progress")
      .select("area_slug, level, xp")
      .eq("user_id", userId)
      .eq("area_slug", areaSlug)
      .maybeSingle(),
  ]);

  const withMeta: AreaMissionWithMeta[] = (missions ?? []).map((m) => {
    const mlogs = (logs ?? []).filter((l) => l.mission_id === m.id);
    return {
      ...(m as AreaMission),
      week_done: mlogs.length,
      last_log_id: mlogs[0]?.id ?? null,
      affinity_match: klass ? (m.class_affinity as string[]).includes(klass) : false,
    };
  });

  const progress: AreaProgress = progRow
    ? { area_slug: areaSlug, level: progRow.level, xp: progRow.xp }
    : { area_slug: areaSlug, level: 1, xp: 0 };

  return { missions: withMeta, progress };
}

export async function logAreaMission(
  userId: string,
  mission: AreaMission,
): Promise<void> {
  const { error } = await supabase.from("area_mission_logs").insert({
    user_id: userId,
    mission_id: mission.id,
    area_slug: mission.area_slug,
  });
  if (error) throw error;
}

export async function undoLastAreaMission(logId: string): Promise<void> {
  const { error } = await supabase.from("area_mission_logs").delete().eq("id", logId);
  if (error) throw error;
}

export async function listAllAreaProgress(userId: string): Promise<AreaProgress[]> {
  const { data, error } = await supabase
    .from("area_progress")
    .select("area_slug, level, xp")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as AreaProgress[];
}

/** XP threshold per area level. Matches DB trigger (200 XP per level). */
export const AREA_XP_PER_LEVEL = 200;

export function areaLevelProgress(xp: number): {
  level: number;
  intoLevel: number;
  pct: number;
} {
  const level = 1 + Math.floor(xp / AREA_XP_PER_LEVEL);
  const intoLevel = xp % AREA_XP_PER_LEVEL;
  return { level, intoLevel, pct: Math.round((intoLevel / AREA_XP_PER_LEVEL) * 100) };
}
