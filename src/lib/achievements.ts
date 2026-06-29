import { supabase } from "@/integrations/supabase/client";

export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

export type Achievement = {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  rarity: AchievementRarity;
  criteria: { type: string; value: number; area?: string };
  lore_fragment: string | null;
  xp_reward: number;
  brasas_reward: number;
  sort_order: number;
};

export type UserAchievement = {
  achievement_id: string;
  unlocked_at: string;
  seen: boolean;
};

export type UnlockedAchievement = {
  code: string;
  title: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  lore_fragment: string | null;
  xp_reward: number;
  brasas_reward: number;
};

export type LoreChapter = {
  id: string;
  code: string;
  chapter_number: number;
  title: string;
  subtitle: string | null;
  body: string;
  unlock_level: number;
  unlock_achievement_code: string | null;
};

export async function listAchievements(): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from("achievements")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Achievement[];
}

export async function listUserAchievements(userId: string): Promise<UserAchievement[]> {
  const { data, error } = await supabase
    .from("user_achievements")
    .select("achievement_id, unlocked_at, seen")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as UserAchievement[];
}

export async function checkAchievements(): Promise<UnlockedAchievement[]> {
  const { data, error } = await supabase.rpc("check_achievements");
  if (error) throw error;
  const payload = (data ?? {}) as { unlocked?: UnlockedAchievement[] };
  return payload.unlocked ?? [];
}

export async function markAchievementsSeen(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await supabase
    .from("user_achievements")
    .update({ seen: true })
    .eq("user_id", userId)
    .in("achievement_id", ids);
}

export async function listLoreChapters(): Promise<LoreChapter[]> {
  const { data, error } = await supabase
    .from("lore_chapters")
    .select("*")
    .order("chapter_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LoreChapter[];
}

export async function listReadChapters(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("user_lore")
    .select("chapter_id")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.chapter_id as string));
}

export async function markChapterRead(userId: string, chapterId: string): Promise<void> {
  await supabase
    .from("user_lore")
    .insert({ user_id: userId, chapter_id: chapterId })
    .select()
    .maybeSingle();
}

export const RARITY_STYLES: Record<AchievementRarity, { label: string; ring: string; text: string; bg: string }> = {
  common:    { label: "COMUM",     ring: "ring-muted-foreground/40", text: "text-muted-foreground", bg: "bg-charcoal-900" },
  rare:      { label: "RARO",      ring: "ring-sky-400/60",          text: "text-sky-300",          bg: "bg-sky-950/40" },
  epic:      { label: "ÉPICO",     ring: "ring-violet-400/70",       text: "text-violet-300",       bg: "bg-violet-950/40" },
  legendary: { label: "LENDÁRIO",  ring: "ring-ember/80",            text: "text-ember",            bg: "bg-ember/10" },
};
