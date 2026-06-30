import { supabase } from "@/integrations/supabase/client";

// ---------- Casa: Intenção da Semana ----------

function weekKey(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export type CasaIntention = { week: string; text: string };

export async function getCasaIntention(userId: string): Promise<CasaIntention | null> {
  const { data, error } = await supabase
    .from("area_progress")
    .select("meta")
    .eq("user_id", userId)
    .eq("area_slug", "casa")
    .maybeSingle();
  if (error) throw error;
  const meta = (data?.meta ?? {}) as Record<string, unknown>;
  const intent = meta.weekly_intention as CasaIntention | undefined;
  if (!intent || intent.week !== weekKey()) return null;
  return intent;
}

export async function setCasaIntention(userId: string, text: string): Promise<CasaIntention> {
  const intent: CasaIntention = { week: weekKey(), text: text.trim() };
  const { data: existing } = await supabase
    .from("area_progress")
    .select("id, meta")
    .eq("user_id", userId)
    .eq("area_slug", "casa")
    .maybeSingle();
  const meta = { ...((existing?.meta ?? {}) as Record<string, unknown>), weekly_intention: intent };
  if (existing) {
    const { error } = await supabase.from("area_progress").update({ meta }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("area_progress")
      .insert({ user_id: userId, area_slug: "casa", level: 1, xp: 0, meta });
    if (error) throw error;
  }
  return intent;
}

// ---------- Jardim Mental: gratidões + crença ----------

export type MentalEntry = {
  id: string;
  log_date: string;
  gratitudes: string[];
  limiting_belief: string | null;
  reframe: string | null;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getTodayMentalEntry(userId: string): Promise<MentalEntry | null> {
  const { data, error } = await supabase
    .from("mental_journal")
    .select("id, log_date, gratitudes, limiting_belief, reframe")
    .eq("user_id", userId)
    .eq("log_date", todayISO())
    .maybeSingle();
  if (error) throw error;
  return (data as MentalEntry | null) ?? null;
}

export async function saveTodayMentalEntry(
  userId: string,
  payload: { gratitudes: string[]; limiting_belief: string | null; reframe: string | null },
): Promise<MentalEntry> {
  const row = {
    user_id: userId,
    log_date: todayISO(),
    gratitudes: payload.gratitudes.map((g) => g.trim()).filter(Boolean),
    limiting_belief: payload.limiting_belief?.trim() || null,
    reframe: payload.reframe?.trim() || null,
  };
  const { data, error } = await supabase
    .from("mental_journal")
    .upsert(row, { onConflict: "user_id,log_date" })
    .select("id, log_date, gratitudes, limiting_belief, reframe")
    .single();
  if (error) throw error;
  return data as MentalEntry;
}
