import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ASSISTANT_NAME_MAX } from "./assistant-name";

export type AssistantMessage = { role: "user" | "assistant"; content: string; created_at: string };
export type Conversation = { id: string; title: string; updated_at: string };
export type VoiceGender = "feminina" | "masculina";
export type ChatSettings = {
  persona: "caloroso" | "direto" | "tecnico";
  response_length: "curtas" | "equilibrado" | "detalhadas";
  focus: "geral" | "treino" | "nutricao" | "mente";
  custom_instructions: string;
  /** Vazio = usar ASSISTANT_NAME_FALLBACK. */
  assistant_name: string;
  /** Gênero da voz da IA (TTS + Web Speech fallback). */
  voice_gender: VoiceGender;
  /** Ao abrir a IA: começar nova conversa ou retomar a última. */
  open_mode: "new" | "last";
};

export {
  ASSISTANT_NAME_FALLBACK,
  ASSISTANT_NAME_MAX,
  assistantName,
  assistantGreeting,
} from "./assistant-name";

export const CHAT_SETTINGS_DEFAULT: ChatSettings = {
  persona: "caloroso",
  response_length: "equilibrado",
  focus: "geral",
  custom_instructions: "",
  assistant_name: "",
  voice_gender: "feminina",
  open_mode: "new",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

// --- Conversas -------------------------------------------------------------

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Conversation[]> => {
    const db = context.supabase as Db;
    const { data } = await db
      .from("chat_conversations")
      .select("id, title, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    return (data ?? []) as Conversation[];
  });

export const getConversationMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<AssistantMessage[]> => {
    const db = context.supabase as Db;
    const { data: rows } = await db
      .from("assistant_messages")
      .select("role, content, created_at")
      .eq("user_id", context.userId)
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: true })
      .limit(200);
    return (rows ?? []) as AssistantMessage[];
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = context.supabase as Db;
    // ON DELETE CASCADE apaga as mensagens junto.
    await db.from("chat_conversations").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

export const renameConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = context.supabase as Db;
    await db
      .from("chat_conversations")
      .update({ title: data.title })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

// --- Configuração da IA ----------------------------------------------------

export const getChatSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChatSettings> => {
    const db = context.supabase as Db;
    const { data } = await db
      .from("chat_settings")
      .select("persona, response_length, focus, custom_instructions, assistant_name, voice_gender")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { ...CHAT_SETTINGS_DEFAULT, ...((data ?? {}) as Partial<ChatSettings>) };
  });

export const saveChatSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        persona: z.enum(["caloroso", "direto", "tecnico"]),
        response_length: z.enum(["curtas", "equilibrado", "detalhadas"]),
        focus: z.enum(["geral", "treino", "nutricao", "mente"]),
        custom_instructions: z.string().max(500),
        // trim + max: "  " vira "" e cai no fallback (WiMi).
        assistant_name: z.string().trim().max(ASSISTANT_NAME_MAX),
        voice_gender: z.enum(["feminina", "masculina"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = context.supabase as Db;
    await db
      .from("chat_settings")
      .upsert(
        { user_id: context.userId, ...data, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    return { ok: true };
  });

// --- Compat (lista plana antiga) ------------------------------------------

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
