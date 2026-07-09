import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AssistantMessage = { role: "user" | "assistant"; content: string; created_at: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const listAssistantMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AssistantMessage[]> => {
    const db = context.supabase as Db;
    const { data } = await db
      .from("assistant_messages")
      .select("role, content, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(100);
    return (data ?? []) as AssistantMessage[];
  });

export const clearAssistantMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const db = context.supabase as Db;
    await db.from("assistant_messages").delete().eq("user_id", context.userId);
    return { ok: true };
  });
