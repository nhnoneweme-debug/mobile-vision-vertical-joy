import { supabase } from "@/integrations/supabase/client";

export type OrientadorMessage = {
  id: string;
  orientador_id: string;
  student_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export async function listMessages(
  orientadorId: string,
  studentId: string,
  limit = 100,
): Promise<OrientadorMessage[]> {
  const { data, error } = await supabase
    .from("orientador_messages")
    .select("*")
    .eq("orientador_id", orientadorId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as OrientadorMessage[]).reverse();
}

export async function sendMessage(input: {
  orientadorId: string;
  studentId: string;
  body: string;
}): Promise<void> {
  const body = input.body.trim();
  if (!body) throw new Error("Mensagem vazia.");
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado.");
  const { error } = await supabase.from("orientador_messages").insert({
    orientador_id: input.orientadorId,
    student_id: input.studentId,
    sender_id: u.user.id,
    body: body.slice(0, 4000),
  });
  if (error) throw error;
}

export async function markThreadRead(
  orientadorId: string,
  studentId: string,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase
    .from("orientador_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("orientador_id", orientadorId)
    .eq("student_id", studentId)
    .neq("sender_id", u.user.id)
    .is("read_at", null);
}

export function subscribeThread(
  orientadorId: string,
  studentId: string,
  onInsert: (m: OrientadorMessage) => void,
) {
  const channel = supabase
    .channel(`orientador_messages:${orientadorId}:${studentId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "orientador_messages",
        filter: `student_id=eq.${studentId}`,
      },
      (payload) => {
        const row = payload.new as OrientadorMessage;
        if (row.orientador_id === orientadorId) onInsert(row);
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** For a student: list active orientadores they can chat with. */
export async function listMyOrientadores(studentId: string) {
  const { data, error } = await supabase
    .from("orientador_students")
    .select("orientador_id")
    .eq("student_id", studentId)
    .eq("status", "active");
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.orientador_id);
  if (ids.length === 0) return [];
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids);
  return (profs ?? []) as Array<{
    id: string;
    display_name: string | null;
  }>;
}

