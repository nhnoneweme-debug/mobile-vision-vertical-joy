import { supabase } from "@/integrations/supabase/client";

export type ChallengePerspective = {
  name: string;
  metric: "habit_completion" | "streak_min" | "xp_total" | "posts_count" | "rituals_count";
  target: number;
};

export const METRIC_LABELS: Record<ChallengePerspective["metric"], string> = {
  habit_completion: "Hábitos concluídos",
  streak_min: "Streak mínimo",
  xp_total: "XP total",
  posts_count: "Posts publicados",
  rituals_count: "Rituais registrados",
};

export type StudioReward = {
  id: string;
  kind: "crystal" | "brasas" | "xp" | "inventory_item" | "badge";
  name: string;
  description: string | null;
  payload: Record<string, unknown>;
  active: boolean;
};

export type StudioChallenge = {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  start_at: string | null;
  end_at: string | null;
  rules: { perspectives: ChallengePerspective[] };
  status: "draft" | "published" | "archived";
};

export async function checkStudioAdmin(): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .eq("role", "studio_admin")
    .maybeSingle();
  return !!data;
}

export async function listRewards(): Promise<StudioReward[]> {
  const { data, error } = await supabase
    .from("studio_rewards")
    .select("id, kind, name, description, payload, active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudioReward[];
}

export async function createReward(input: Omit<StudioReward, "id" | "active">) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado.");
  const { error } = await supabase.from("studio_rewards").insert({
    kind: input.kind,
    name: input.name,
    description: input.description,
    payload: input.payload as never,
    created_by: u.user.id,
  });
  if (error) throw error;
}

export async function listChallengesStudio(adminMode = true): Promise<StudioChallenge[]> {
  const q = supabase
    .from("studio_challenges")
    .select("id, title, description, cover_url, start_at, end_at, rules, status")
    .order("created_at", { ascending: false });
  if (!adminMode) q.eq("status", "published");
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as StudioChallenge[];
}

export async function createChallenge(input: Omit<StudioChallenge, "id" | "status"> & { status?: StudioChallenge["status"] }) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado.");
  const { data, error } = await supabase
    .from("studio_challenges")
    .insert({
      title: input.title,
      description: input.description,
      cover_url: input.cover_url,
      start_at: input.start_at,
      end_at: input.end_at,
      rules: input.rules as never,
      status: input.status ?? "draft",
      created_by: u.user.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function publishChallenge(id: string) {
  const { error } = await supabase
    .from("studio_challenges")
    .update({ status: "published" })
    .eq("id", id);
  if (error) throw error;
}

export async function attachReward(challengeId: string, rewardId: string, tier = 1) {
  const { error } = await supabase
    .from("studio_challenge_rewards")
    .insert({ challenge_id: challengeId, reward_id: rewardId, tier });
  if (error) throw error;
}

export async function evaluateMyProgress(challengeId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase.rpc("evaluate_challenge", {
    _user: u.user.id,
    _challenge: challengeId,
  });
  if (error) throw error;
  return (data as { name: string; metric: string; target: number; actual: number; pct: number }[]) ?? [];
}

export async function joinChallenge(challengeId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado.");
  const { error } = await supabase
    .from("studio_challenge_participants")
    .insert({ challenge_id: challengeId, user_id: u.user.id })
    .select()
    .maybeSingle();
  if (error && !String(error.message).includes("duplicate")) throw error;
}

export async function listChallengeRewards(challengeId: string) {
  const { data, error } = await supabase
    .from("studio_challenge_rewards")
    .select("id, tier, criteria, studio_rewards!inner(id, kind, name, description, payload)")
    .eq("challenge_id", challengeId)
    .order("tier");
  if (error) throw error;
  return (data ?? []) as unknown as {
    id: string;
    tier: number;
    criteria: Record<string, unknown>;
    studio_rewards: StudioReward;
  }[];
}
