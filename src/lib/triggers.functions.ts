// Ações agênticas dos gatilhos: a IA interpreta linguagem natural e devolve um
// RASCUNHO estruturado. Nada é salvo automaticamente — o usuário revisa no
// builder e só então grava. Toda proposta gerada por IA vira uma linha
// pendente em ai_audit_log (mesmo fluxo de auditoria do ia-capture).

import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createChatModelWithFallback } from "@/lib/ai-gateway.server";

const SYSTEM = `Você é a WiMi interpretando pedidos de automação de um app de execução pessoal.
Responda SEMPRE apenas com um objeto JSON válido, sem markdown e sem comentários.

Formato:
{
  "name": "nome curto do gatilho",
  "trigger_type": "chronos" | "event",
  "condition": um destes:
     {"mode":"at_time","time":"HH:MM"}
   | {"mode":"every","seconds":N}
   | {"mode":"after_session","seconds":N}
   | {"source":"audio","keyword":"palavra"}
   | {"source":"motion","kind":"spike","min_magnitude":N}
   | {"source":"motion","kind":"angle_change","min_degrees":N},
  "action": {
     "vibrate": {"onSec":1..10} (opcional),
     "audio_tone": {"onSec":1..10} (opcional),
     "stop_actuators": true (opcional),
     "sensors": {"mic":bool,"camera":bool,"motion":bool} (opcional),
     "journey_log_prompt": true (opcional — abrir o log de jornada),
     "message": "texto curto que a WiMi mostra" (opcional)
  },
  "active_window": {"start":"HH:MM","end":"HH:MM","days":[0..6]} (opcional, {} se não houver),
  "cooldown_seconds": inteiro entre 0 e 3600,
  "summary": "uma frase em português explicando o que foi entendido"
}
Use apenas as primitivas acima. Quando o pedido não couber nelas, aproxime com
"message" descrevendo o que a WiMi deve dizer no momento do disparo.`;

const CUSTOM_SYSTEM = `Você é a WiMi convertendo uma AÇÃO PERSONALIZADA descrita em linguagem natural
em ações primitivas de um app de execução. Responda SEMPRE apenas com JSON válido:
{
  "action": { "vibrate": {"onSec":N}, "audio_tone": {"onSec":N}, "stop_actuators": true,
              "sensors": {"mic":bool,"camera":bool,"motion":bool},
              "journey_log_prompt": true, "message": "texto que a WiMi diz no disparo" },
  "plan": "uma frase em português descrevendo o plano de ação interpretado"
}
Inclua apenas as chaves relevantes. Se nada primitivo servir, use somente "message".`;

function parseJson(text: string): string {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("A IA não devolveu um plano legível.");
  const slice = cleaned.slice(start, end + 1);
  JSON.parse(slice); // valida antes de devolver
  return slice;
}

const promptSchema = z.object({
  text: z.string().min(3).max(2000),
  context: z.string().max(2000).optional(),
});

async function ask(system: string, prompt: string) {
  const model = createChatModelWithFallback();
  const { text } = await generateText({ model, system, prompt });
  return parseJson(text);
}

/** D2 — descrição livre do gatilho inteiro → rascunho estruturado para revisão. */
export const interpretTriggerSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => promptSchema.parse(d))
  .handler(async ({ data, context }) => {
    const draft_json = await ask(SYSTEM, data.text);
    const { supabase, userId } = context;
    const { data: audit } = await supabase
      .from("ai_audit_log")
      .insert({
        user_id: userId,
        table_name: "trigger_definitions",
        action: "trigger.propose",
        status: "pending",
        payload: { input: data.text, draft: JSON.parse(draft_json) } as never,
      })
      .select("id")
      .maybeSingle();
    return { draft_json, audit_id: (audit?.id as string | undefined) ?? null };
  });

/** D1 — instrução de ação personalizada → combinação de primitivas + plano. */
export const interpretCustomAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => promptSchema.parse(d))
  .handler(async ({ data, context }) => {
    const prompt = data.context ? `${data.text}\n\nContexto da sessão: ${data.context}` : data.text;
    const parsed_json = await ask(CUSTOM_SYSTEM, prompt);
    const { supabase, userId } = context;
    const { data: audit } = await supabase
      .from("ai_audit_log")
      .insert({
        user_id: userId,
        table_name: "trigger_definitions",
        action: "trigger.custom_action",
        status: "pending",
        payload: { input: data.text, parsed: JSON.parse(parsed_json) } as never,
      })
      .select("id")
      .maybeSingle();
    return { parsed_json, audit_id: (audit?.id as string | undefined) ?? null };
  });

const resolveSchema = z.object({
  audit_id: z.string().uuid(),
  status: z.enum(["applied", "rejected"]),
});

/** Fecha a linha de auditoria quando o usuário salva ou descarta a proposta. */
export const resolveTriggerProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => resolveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("ai_audit_log")
      .update({ status: data.status })
      .eq("id", data.audit_id)
      .eq("user_id", userId);
    return { ok: true };
  });
