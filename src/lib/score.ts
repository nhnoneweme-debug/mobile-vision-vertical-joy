import { supabase } from "@/integrations/supabase/client";

export type ScoreBreakdownItem = {
  value: number;
  score: number;
  max: number;
};

export type ScoreBreakdown = {
  xp: ScoreBreakdownItem;
  areas: ScoreBreakdownItem;
  habits: ScoreBreakdownItem;
  streak: ScoreBreakdownItem;
};

export type PersonalIaScore = {
  score: number;
  breakdown: ScoreBreakdown;
};

export type ScoreSnapshot = {
  week_start: string;
  score: number;
  breakdown: ScoreBreakdown;
};

export async function fetchCurrentScore(userId: string): Promise<PersonalIaScore> {
  const { data, error } = await supabase.rpc("compute_personal_ia_score", {
    _user_id: userId,
  });
  if (error) throw error;
  return data as unknown as PersonalIaScore;
}

export async function fetchScoreHistory(
  userId: string,
  weeks = 8,
): Promise<ScoreSnapshot[]> {
  const { data, error } = await supabase
    .from("score_snapshots")
    .select("week_start, score, breakdown")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(weeks);
  if (error) throw error;
  return ((data ?? []) as unknown as ScoreSnapshot[]).reverse();
}

export async function saveCurrentSnapshot(
  userId: string,
  current: PersonalIaScore,
): Promise<void> {
  // Week starts on Monday (ISO).
  const today = new Date();
  const day = today.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // shift so Monday=0
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - diff);
  const wk = monday.toISOString().slice(0, 10);

  await supabase.from("score_snapshots").upsert(
    {
      user_id: userId,
      week_start: wk,
      score: current.score,
      breakdown: current.breakdown as unknown as Record<string, unknown>,
    },
    { onConflict: "user_id,week_start" },
  );
}

export const DIMENSION_LABEL: Record<keyof ScoreBreakdown, string> = {
  xp: "XP global",
  areas: "Áreas",
  habits: "Hábitos",
  streak: "Streak",
};

export const DIMENSION_UNIT: Record<keyof ScoreBreakdown, string> = {
  xp: "XP",
  areas: "XP médio",
  habits: "% cumprido",
  streak: "dias",
};
