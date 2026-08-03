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
   | {"source":"audio","keyword":"palavra"},
  "action": {
     "vibrate": {"onSec":1..10} (opcional),
     "audio_tone": {"onSec":1..10} (opcional),
     "stop_actuators": true (opcional),
     "sensors": {"mic":bool,"camera":bool} (opcional),
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
              "sensors": {"mic":bool,"camera":bool},
              "journey_log_prompt": true, "message": "texto que a WiMi diz no disparo" },
  "plan": "uma frase em português descrevendo o plano de ação interpretado"
}
Inclua apenas as chaves relevantes. Se nada primitivo servir, use somente "message".`;

/** Extrai {persona,reply_lang,message}; sem JSON válido, o texto vale como fala da Wi. */
function parsePersonaReply(raw: string): {
  persona: "wi" | "mi";
  reply_lang: string | null;
  message: string;
} {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const obj = JSON.parse(cleaned.slice(start, end + 1)) as {
        persona?: unknown;
        reply_lang?: unknown;
        message?: unknown;
      };
      const message = typeof obj.message === "string" ? obj.message.trim() : "";
      if (message)
        return {
          persona: obj.persona === "mi" ? "mi" : "wi",
          reply_lang: typeof obj.reply_lang === "string" ? obj.reply_lang : null,
          message,
        };
    } catch {
      /* fallback textual */
    }
  }
  return { persona: "wi", reply_lang: null, message: cleaned };
}


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

function promptSystem(directive?: string, sessionLang?: string): string {
  return `Você é a WiMi se manifestando durante uma sessão de execução ao vivo.
Recebe uma INSTRUÇÃO escrita pelo próprio usuário (elemento "Prompt" de um gatilho) e o
contexto da sessão. Responda direto, no máximo 3 frases curtas, sem markdown,
como uma fala que será mostrada e lida em voz alta no momento do disparo.

IDIOMA: esta é uma manifestação PROATIVA — use o idioma predominante da sessão recente${
    sessionLang ? ` (idioma predominante detectado: ${sessionLang})` : ""
  }. Informe o idioma usado no campo "reply_lang".

${
  directive && directive.trim()
    ? directive.trim()
    : `IDENTIDADES DO PAR "WIMI" — a fala é assinada por UMA delas:
• "wi" (Wi, TUTORA, acolhedora): acompanhamento, prática, instrução, incentivo, rituais.
• "mi" (Mi, MENTOR, direto): decisão, estratégia, revisão crítica, avaliação de progresso.`
}
FORMATO OBRIGATÓRIO: responda APENAS com JSON válido, sem markdown:
{"persona":"wi"|"mi","reply_lang":"pt-BR"|"en-US"|"es-ES","message":"a fala"}
Na dúvida, use "wi".`;
}

const runPromptSchema = z.object({
  instruction: z.string().min(3).max(2000),
  context: z.string().max(4000).optional(),
  trigger_name: z.string().max(120).optional(),
  /** "quem manifesta" definido no gatilho; ausente = o modelo decide. */
  force_persona: z.enum(["wi", "mi"]).optional(),
  /** modelo de personas ativo do usuário (Studio de Personas) */
  persona_directive: z.string().max(3000).optional(),
  /** idioma predominante da sessão recente, para manifestações proativas */
  session_lang: z.string().max(10).optional(),
});

/** Adendo D — ELEMENTO PROMPT: executa a instrução em linguagem natural no disparo. */
export const runTriggerPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => runPromptSchema.parse(d))
  .handler(async ({ data, context }) => {
    const model = createChatModelWithFallback();
    const prompt = [
      `Instrução do gatilho${data.trigger_name ? ` "${data.trigger_name}"` : ""}: ${data.instruction}`,
      data.context ? `Contexto da sessão ao vivo:\n${data.context}` : "",
      data.force_persona
        ? `Este gatilho é destinado à identidade "${data.force_persona}": responda como ela.`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const { text } = await generateText({
      model,
      system: promptSystem(data.persona_directive, data.session_lang),
      prompt,
    });
    const parsed = parsePersonaReply(text);
    const persona = data.force_persona ?? parsed.persona;
    const message = parsed.message;
    const { supabase, userId } = context;
    await supabase.from("ai_audit_log").insert({
      user_id: userId,
      table_name: "trigger_definitions",
      action: "trigger.prompt_run",
      status: "applied",
      payload: {
        instruction: data.instruction,
        output: message,
        persona,
        reply_lang: parsed.reply_lang,
      } as never,
    });
    return { message, persona, reply_lang: parsed.reply_lang };
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

// ------------------------------------------------------ RELATÓRIO GERAL
//
// "Resumir com a WiMi": mesma pipeline de auditoria do ia-capture — a proposta
// nasce como linha em ai_audit_log e é entregue em texto (e voz, no cliente).

const REPORT_SYSTEM = `Você é a WiMi analisando o RELATÓRIO DE RETORNO dos gatilhos de execução do usuário.
Receberá um JSON com gatilhos, últimos disparos, resultados por ação e taxas de sucesso.
Responda em português, sem markdown, em no máximo 6 frases curtas:
o que está funcionando, o que está falhando (e por quê, quando o detalhe permitir),
e uma recomendação prática. Se não houver disparos, diga isso com honestidade.`;

const reportSchema = z.object({ report_json: z.string().min(2).max(20000) });

export const summarizeTriggerReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reportSchema.parse(d))
  .handler(async ({ data, context }) => {
    const model = createChatModelWithFallback();
    const { text } = await generateText({
      model,
      system: REPORT_SYSTEM,
      prompt: `Relatório bruto:\n${data.report_json}`,
    });
    const message = text.trim();
    const { supabase, userId } = context;
    await supabase.from("ai_audit_log").insert({
      user_id: userId,
      table_name: "trigger_firings",
      action: "trigger.report_summary",
      status: "applied",
      payload: { output: message } as never,
    });
    return { message };
  });
