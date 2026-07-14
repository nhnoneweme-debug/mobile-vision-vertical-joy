import { supabase } from "@/integrations/supabase/client";

export type ReportTarget = "post" | "comment" | "user" | "message";

export async function reportContent(
  target_type: ReportTarget,
  target_id: string,
  reason: string,
) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado.");
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw new Error("Descreva o motivo (mín. 3 caracteres).");
  if (trimmed.length > 500) throw new Error("Motivo muito longo (máx. 500).");
  const { error } = await supabase.from("content_reports").insert({
    reporter_id: u.user.id,
    target_type,
    target_id,
    reason: trimmed,
  });
  if (error) throw error;
}

export async function blockUser(blocked_id: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado.");
  if (u.user.id === blocked_id) throw new Error("Você não pode se bloquear.");
  const { error } = await supabase
    .from("user_blocks")
    .insert({ blocker_id: u.user.id, blocked_id });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function unblockUser(blocked_id: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", u.user.id)
    .eq("blocked_id", blocked_id);
}

export async function listMyBlocks(): Promise<
  { blocked_id: string; display_name: string | null; created_at: string }[]
> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase
    .from("user_blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", u.user.id);
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.blocked_id);
  const { data: profs } = await supabase
    .rpc("public_profiles_lookup", { _ids: ids });
  const map = new Map(
    ((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name]),
  );

  return rows.map((r) => ({
    blocked_id: r.blocked_id,
    display_name: map.get(r.blocked_id) ?? null,
    created_at: r.created_at,
  }));
}

/** Returns set of user ids the current user has blocked or who blocked them. */
export async function getBlockedUserIdSet(): Promise<Set<string>> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return new Set();
  const me = u.user.id;
  const { data } = await supabase
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${me},blocked_id.eq.${me}`);
  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row.blocker_id === me) set.add(row.blocked_id);
    else set.add(row.blocker_id);
  }
  return set;
}
