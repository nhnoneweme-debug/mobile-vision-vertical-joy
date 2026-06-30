import { supabase } from "@/integrations/supabase/client";

export type GroupMessage = {
  id: string;
  group_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name?: string | null;
};

export async function listGroupMessages(
  groupId: string,
  limit = 80,
): Promise<GroupMessage[]> {
  const { data, error } = await supabase
    .from("group_messages")
    .select("id, group_id, user_id, body, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []).reverse();
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  if (ids.length === 0) return rows;
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids);
  const nameMap = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
  return rows.map((r) => ({ ...r, author_name: nameMap.get(r.user_id) ?? null }));
}

export async function sendGroupMessage(groupId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Mensagem vazia.");
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado.");
  const { error } = await supabase
    .from("group_messages")
    .insert({ group_id: groupId, user_id: u.user.id, body: trimmed.slice(0, 2000) });
  if (error) throw error;
}

export async function deleteGroupMessage(id: string) {
  const { error } = await supabase.from("group_messages").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeGroupMessages(
  groupId: string,
  onInsert: (m: GroupMessage) => void,
) {
  const channel = supabase
    .channel(`group_messages:${groupId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "group_messages",
        filter: `group_id=eq.${groupId}`,
      },
      (payload) => {
        const row = payload.new as GroupMessage;
        onInsert(row);
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
