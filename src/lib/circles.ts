import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type Group = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  owner_id: string;
  created_at: string;
};
export type GroupPost = {
  id: string;
  group_id: string;
  user_id: string;
  author_name: string;
  content: string;
  kind: "post" | "treino";
  created_at: string;
};
export type RankRow = { user_id: string; display_name: string; sessions: number };

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
async function myName(): Promise<string> {
  const uid = await myId();
  if (!uid) return "Viajante";
  const { data } = await db.from("profiles").select("display_name").eq("id", uid).maybeSingle();
  return (data?.display_name as string | undefined) ?? "Viajante";
}

export async function listMyGroups(): Promise<Group[]> {
  const uid = await myId();
  if (!uid) return [];
  const { data, error } = await db
    .from("group_members")
    .select("groups(id,name,description,invite_code,owner_id,created_at)")
    .eq("user_id", uid);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => r.groups).filter(Boolean) as Group[];
}

export async function createGroup(name: string, description?: string): Promise<Group> {
  const uid = await myId();
  if (!uid) throw new Error("Faça login.");
  const { data, error } = await db
    .from("groups")
    .insert({ owner_id: uid, name: name.trim().slice(0, 60), description: description?.trim() || null })
    .select("id,name,description,invite_code,owner_id,created_at")
    .single();
  if (error) throw error;
  return data as Group;
}

export async function joinByCode(code: string): Promise<string> {
  const { data, error } = await db.rpc("join_group_by_invite", { _code: code.trim().toUpperCase() });
  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("invalid_invite")) throw new Error("Código inválido.");
    throw new Error(msg || "Não consegui entrar.");
  }
  return data as string;
}

export async function leaveGroup(groupId: string): Promise<void> {
  const uid = await myId();
  if (!uid) return;
  const { error } = await db.from("group_members").delete().eq("group_id", groupId).eq("user_id", uid);
  if (error) throw error;
}

export async function groupMemberCount(groupId: string): Promise<number> {
  const { count } = await db.from("group_members").select("id", { count: "exact", head: true }).eq("group_id", groupId);
  return count ?? 0;
}

export async function listGroupFeed(groupId: string): Promise<GroupPost[]> {
  const { data, error } = await db
    .from("group_posts")
    .select("id,group_id,user_id,author_name,content,kind,created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as GroupPost[];
}

export async function postToGroup(groupId: string, content: string, kind: "post" | "treino" = "post"): Promise<void> {
  const uid = await myId();
  if (!uid) throw new Error("Faça login.");
  const author_name = await myName();
  const { error } = await db
    .from("group_posts")
    .insert({ group_id: groupId, user_id: uid, author_name, content: content.trim().slice(0, 500), kind });
  if (error) throw error;
}

export async function weeklyRanking(groupId: string): Promise<RankRow[]> {
  const { data, error } = await db.rpc("group_weekly_ranking", { _group_id: groupId });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    user_id: r.user_id,
    display_name: r.display_name ?? "Viajante",
    sessions: Number(r.sessions ?? 0),
  }));
}
