import { supabase } from "@/integrations/supabase/client";

export type FriendStatus = "pending" | "accepted" | "declined" | "blocked";

export type FriendProfile = {
  id: string;
  display_name: string | null;
  behavioral_class: string | null;
  xp: number;
  streak: number;
  friend_code: string | null;
};

export type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendStatus;
  created_at: string;
  other: FriendProfile | null;
  direction: "incoming" | "outgoing";
};

export type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  owner_id: string;
  created_at: string;
  member_count: number;
  is_owner: boolean;
};

export type ChallengeMetric = "xp" | "quests" | "streak" | "habits";

export type ChallengeRow = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  metric: ChallengeMetric;
  target: number;
  starts_at: string;
  ends_at: string;
  created_by: string;
};

export type ChallengeWithProgress = ChallengeRow & {
  my_value: number;
  leaderboard: { user_id: string; value: number; display_name: string | null }[];
};

// ---------- profiles helpers ----------

export async function getMyFriendCode(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("friend_code")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.friend_code ?? null;
}

async function fetchProfilesByIds(ids: string[]): Promise<Record<string, FriendProfile>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, behavioral_class, xp, streak, friend_code")
    .in("id", ids);
  if (error) throw error;
  const map: Record<string, FriendProfile> = {};
  (data ?? []).forEach((p) => {
    map[p.id] = p as FriendProfile;
  });
  return map;
}

// ---------- friendships ----------

export async function listFriendships(userId: string): Promise<FriendshipRow[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Omit<FriendshipRow, "other" | "direction">[];
  const otherIds = rows.map((r) =>
    r.requester_id === userId ? r.addressee_id : r.requester_id,
  );
  const profiles = await fetchProfilesByIds(otherIds);
  return rows.map((r) => {
    const otherId = r.requester_id === userId ? r.addressee_id : r.requester_id;
    return {
      ...r,
      status: r.status as FriendStatus,
      other: profiles[otherId] ?? null,
      direction: r.requester_id === userId ? "outgoing" : "incoming",
    };
  });
}

export async function sendFriendRequestByCode(userId: string, code: string) {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) throw new Error("Informe um código.");
  const { data: target, error: e1 } = await supabase
    .from("profiles")
    .select("id, friend_code")
    .eq("friend_code", cleaned)
    .maybeSingle();
  if (e1) throw e1;
  if (!target) throw new Error("Código não encontrado.");
  if (target.id === userId) throw new Error("Esse é o seu próprio código.");

  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: userId, addressee_id: target.id, status: "pending" });
  if (error) {
    if (error.code === "23505") throw new Error("Já existe um convite com este viajante.");
    throw error;
  }
}

export async function respondToFriendship(id: string, status: "accepted" | "declined") {
  const { error } = await supabase.from("friendships").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function removeFriendship(id: string) {
  const { error } = await supabase.from("friendships").delete().eq("id", id);
  if (error) throw error;
}

// ---------- groups ----------

export async function listMyGroups(userId: string): Promise<GroupRow[]> {
  const { data: mems, error: e1 } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);
  if (e1) throw e1;
  const ids = (mems ?? []).map((m) => m.group_id);
  if (ids.length === 0) return [];

  const { data: groups, error: e2 } = await supabase
    .from("groups")
    .select("*")
    .in("id", ids);
  if (e2) throw e2;

  const { data: counts, error: e3 } = await supabase
    .from("group_members")
    .select("group_id")
    .in("group_id", ids);
  if (e3) throw e3;
  const countMap = new Map<string, number>();
  (counts ?? []).forEach((c) => countMap.set(c.group_id, (countMap.get(c.group_id) ?? 0) + 1));

  return (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    invite_code: g.invite_code,
    owner_id: g.owner_id,
    created_at: g.created_at,
    member_count: countMap.get(g.id) ?? 1,
    is_owner: g.owner_id === userId,
  }));
}

export async function createGroup(
  userId: string,
  input: { name: string; description?: string },
) {
  const name = input.name.trim();
  if (!name) throw new Error("Dê um nome à guilda.");
  const { error } = await supabase
    .from("groups")
    .insert({
      owner_id: userId,
      name,
      description: input.description?.trim() || null,
      invite_code: "", // trigger overrides
    });
  if (error) throw error;
}

export async function joinGroupByCode(userId: string, code: string) {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) throw new Error("Informe um código.");
  const { data: group, error: e1 } = await supabase
    .from("groups")
    .select("id")
    .eq("invite_code", cleaned)
    .maybeSingle();
  if (e1) throw e1;
  if (!group) throw new Error("Guilda não encontrada.");

  const { error } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, user_id: userId, role: "member" });
  if (error) {
    if (error.code === "23505") throw new Error("Você já pertence a esta guilda.");
    throw error;
  }
  return group.id;
}

export async function leaveGroup(groupId: string, userId: string) {
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function listGroupMembers(groupId: string) {
  const { data, error } = await supabase
    .from("group_members")
    .select("user_id, role")
    .eq("group_id", groupId);
  if (error) throw error;
  const ids = (data ?? []).map((m) => m.user_id);
  const profiles = await fetchProfilesByIds(ids);
  return (data ?? [])
    .map((m) => ({ ...m, profile: profiles[m.user_id] ?? null }))
    .sort((a, b) => (b.profile?.xp ?? 0) - (a.profile?.xp ?? 0));
}

// ---------- challenges ----------

export const METRIC_LABEL: Record<ChallengeMetric, string> = {
  xp: "XP acumulado",
  quests: "Quests concluídas",
  streak: "Dias de streak",
  habits: "Hábitos feitos",
};

export async function listChallenges(
  groupId: string,
  userId: string,
): Promise<ChallengeWithProgress[]> {
  const { data: challenges, error } = await supabase
    .from("challenges")
    .select("*")
    .eq("group_id", groupId)
    .order("ends_at", { ascending: true });
  if (error) throw error;
  const list = (challenges ?? []) as ChallengeRow[];
  if (list.length === 0) return [];

  const ids = list.map((c) => c.id);
  const { data: progress, error: e2 } = await supabase
    .from("challenge_progress")
    .select("challenge_id, user_id, value")
    .in("challenge_id", ids);
  if (e2) throw e2;

  const userIds = Array.from(new Set((progress ?? []).map((p) => p.user_id)));
  const profiles = await fetchProfilesByIds(userIds);

  return list.map((c) => {
    const rows = (progress ?? []).filter((p) => p.challenge_id === c.id);
    const me = rows.find((r) => r.user_id === userId);
    const leaderboard = rows
      .map((r) => ({
        user_id: r.user_id,
        value: r.value,
        display_name: profiles[r.user_id]?.display_name ?? null,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    return {
      ...c,
      metric: c.metric as ChallengeMetric,
      my_value: me?.value ?? 0,
      leaderboard,
    };
  });
}

export async function createChallenge(
  userId: string,
  input: {
    group_id: string;
    title: string;
    description?: string;
    metric: ChallengeMetric;
    target: number;
    days: number;
  },
) {
  const ends = new Date();
  ends.setDate(ends.getDate() + Math.max(1, input.days));
  const { error } = await supabase.from("challenges").insert({
    group_id: input.group_id,
    created_by: userId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    metric: input.metric,
    target: input.target,
    ends_at: ends.toISOString(),
  });
  if (error) throw error;
}

export async function bumpMyProgress(
  challengeId: string,
  userId: string,
  delta = 1,
) {
  const { data: existing, error: e1 } = await supabase
    .from("challenge_progress")
    .select("id, value")
    .eq("challenge_id", challengeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (e1) throw e1;
  if (existing) {
    const { error } = await supabase
      .from("challenge_progress")
      .update({ value: existing.value + delta })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("challenge_progress")
      .insert({ challenge_id: challengeId, user_id: userId, value: delta });
    if (error) throw error;
  }
}
