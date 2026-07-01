import { supabase } from "@/integrations/supabase/client";

export type MentalHistoryEntry = {
  id: string;
  log_date: string;
  gratitudes: string[];
  limiting_belief: string | null;
  reframe: string | null;
};

export type BeliefConfrontation = {
  id: string;
  belief: string;
  log_date: string;
  faced: boolean;
  note: string | null;
};

export async function listMentalHistory(
  userId: string,
  fromISO: string,
  toISO: string,
): Promise<MentalHistoryEntry[]> {
  const { data, error } = await supabase
    .from("mental_journal")
    .select("id, log_date, gratitudes, limiting_belief, reframe")
    .eq("user_id", userId)
    .gte("log_date", fromISO)
    .lte("log_date", toISO)
    .order("log_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MentalHistoryEntry[];
}

export async function listUniqueBeliefs(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("mental_journal")
    .select("limiting_belief")
    .eq("user_id", userId)
    .not("limiting_belief", "is", null)
    .order("log_date", { ascending: false })
    .limit(200);
  if (error) throw error;
  const set = new Set<string>();
  for (const row of data ?? []) {
    const b = (row.limiting_belief ?? "").trim();
    if (b) set.add(b);
  }
  return Array.from(set);
}

export async function listTodayConfrontations(
  userId: string,
): Promise<BeliefConfrontation[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("belief_confrontations")
    .select("id, belief, log_date, faced, note")
    .eq("user_id", userId)
    .eq("log_date", today);
  if (error) throw error;
  return (data ?? []) as BeliefConfrontation[];
}

export async function listConfrontationHistory(
  userId: string,
  belief: string,
  days = 30,
): Promise<BeliefConfrontation[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const { data, error } = await supabase
    .from("belief_confrontations")
    .select("id, belief, log_date, faced, note")
    .eq("user_id", userId)
    .eq("belief", belief)
    .gte("log_date", from.toISOString().slice(0, 10))
    .order("log_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BeliefConfrontation[];
}

export async function toggleBeliefFacedToday(
  userId: string,
  belief: string,
  faced: boolean,
  note?: string,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("belief_confrontations")
    .upsert(
      {
        user_id: userId,
        belief: belief.trim(),
        log_date: today,
        faced,
        note: note?.trim() || null,
      },
      { onConflict: "user_id,belief,log_date" },
    );
  if (error) throw error;
}
