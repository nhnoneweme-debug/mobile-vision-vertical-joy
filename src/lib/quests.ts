import { supabase } from "@/integrations/supabase/client";
import { buildDailyQuest, type QuestInput } from "./quest";

export type DailyQuestRow = {
  id: string;
  user_id: string;
  quest_date: string;
  area_slug: string;
  title: string;
  subtitle: string;
  xp_reward: number;
  status: "pending" | "completed" | "skipped";
  completed_at: string | null;
  effort: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

function todayISO(): string {
  // user-local date YYYY-MM-DD
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function ensureTodayQuest(
  userId: string,
  input: QuestInput,
): Promise<DailyQuestRow> {
  const today = todayISO();

  const { data: existing, error: selErr } = await supabase
    .from("daily_quests")
    .select("*")
    .eq("user_id", userId)
    .eq("quest_date", today)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing as DailyQuestRow;

  const quest = buildDailyQuest(input);
  const { data: inserted, error: insErr } = await supabase
    .from("daily_quests")
    .insert({
      user_id: userId,
      quest_date: today,
      area_slug: quest.slug,
      title: quest.title,
      subtitle: quest.subtitle,
      xp_reward: quest.xp,
    })
    .select("*")
    .single();
  if (insErr) throw insErr;
  return inserted as DailyQuestRow;
}

export async function completeQuest(
  id: string,
  effort: number,
  note: string | null,
): Promise<DailyQuestRow> {
  const { data, error } = await supabase
    .from("daily_quests")
    .update({
      status: "completed",
      effort,
      note: note?.trim() ? note.trim().slice(0, 140) : null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  supabase.rpc("check_perk_unlocks").then(() => {}, () => {});
  return data as DailyQuestRow;
}

export async function listRecentQuests(
  userId: string,
  limit = 7,
): Promise<DailyQuestRow[]> {
  const { data, error } = await supabase
    .from("daily_quests")
    .select("*")
    .eq("user_id", userId)
    .order("quest_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DailyQuestRow[];
}
