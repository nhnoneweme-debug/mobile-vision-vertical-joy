// LIVE DINÂMICO — análise contínua, resposta no handover e conversa sobre a
// sessão. Toda chamada de modelo mora aqui, no servidor.

import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createChatModelWithFallback } from "@/lib/ai-gateway.server";

/** Marcador de "não é comigo": o cliente registra e não interrompe. */
export const SILENCE_TOKEN = "[SILENCIO]";

// ---------------------------------------------------------- IDENTIDADES
// Toda resposta falada sai assinada por UMA identidade do par WiMi.
const PERSONA_RULES = `IDENTIDADES DO PAR "WIMI" — toda resposta é assinada por UMA delas:
• "wi" (Wi, TUTORA, tom acolhedor): acompanhamento do dia a dia, dúvidas práticas,
  instrução e explicação, incentivo, perguntas de log de jornada, rituais de noite/manhã.
• "mi" (Mi, MENTOR, tom direto): decisões, estratégia, revisão crítica, confronto honesto
  com o que foi registrado antes, avaliação de progresso.
Escolha a identidade pelo tipo de pedido, não pelo humor. Na dúvida, use "wi".`;

const PERSONA_FORMAT = `FORMATO DE SAÍDA OBRIGATÓRIO: responda APENAS com JSON válido, sem markdown:
{"persona":"wi"|"mi","message":"a fala"}`;

function parsePersonaReply(raw: string): { persona: "wi" | "mi"; message: string } {
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
        message?: unknown;
      };
      const message = typeof obj.message === "string" ? obj.message.trim() : "";
      if (message) return { persona: obj.persona === "mi" ? "mi" : "wi", message };
    } catch {
      /* cai no fallback textual abaixo */
    }
  }
  // Fallback honesto: sem JSON válido, o texto vale como fala da Wi.
  return { persona: "wi", message: cleaned };
}

const UNDERSTANDING_SYSTEM = `Você é a WiMi acompanhando uma conversa ao vivo EM TEMPO REAL.
Receberá a transcrição corrente (pode estar incompleta). Devolva, em português e sem markdown,
no MÁXIMO 2 frases curtas: o que está sendo tratado agora e o que provavelmente será pedido.
Não responda ao usuário, não faça perguntas — isto é uma nota interna de compreensão.`;

const understandingSchema = z.object({ transcript: z.string().min(1).max(6000) });

/** (1) Pré-aquecimento: entendimento rolante da conversa, atualizado durante a fala. */
export const liveUnderstanding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => understandingSchema.parse(d))
  .handler(async ({ data }) => {
    const model = createChatModelWithFallback();
    const { text } = await generateText({
      model,
      system: UNDERSTANDING_SYSTEM,
      prompt: `Transcrição corrente:\n${data.transcript}`,
    });
    return { understanding: text.trim().slice(0, 600) };
  });

const REPLY_SYSTEM = `Você é a WiMi conversando por voz durante uma sessão de execução ao vivo.
Você já vinha acompanhando a conversa; agora o interlocutor passou o turno para você.

REGRA DE ENDEREÇAMENTO: se a fala claramente NÃO é dirigida a você — conversa entre pessoas,
vocativo com o nome de outra pessoa, instrução dada a terceiros — responda EXATAMENTE
"${SILENCE_TOKEN}" e nada mais. Na dúvida, prefira o silêncio: nunca atrapalhe uma conversa humana.

Se a fala é para você, responda em português, no máximo 3 frases curtas, sem markdown,
como uma fala que será lida em voz alta. Seja específico com o que foi dito.

${PERSONA_RULES}
${PERSONA_FORMAT}
Se for silêncio, devolva {"persona":"wi","message":"${SILENCE_TOKEN}"}.`;

const replySchema = z.object({
  turn: z.string().min(1).max(4000),
  understanding: z.string().max(1000).optional(),
  recent: z.string().max(4000).optional(),
  addressed_by_code: z.boolean().optional(),
  force_persona: z.enum(["wi", "mi"]).optional(),
});

/** (2/3) Resposta no handover, já com o contexto montado durante a fala. */
export const liveHandoverReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => replySchema.parse(d))
  .handler(async ({ data, context }) => {
    const model = createChatModelWithFallback();
    const prompt = [
      data.understanding ? `Entendimento acumulado da conversa: ${data.understanding}` : "",
      data.recent ? `Falas recentes:\n${data.recent}` : "",
      `Último turno (fim de turno detectado):\n${data.turn}`,
      data.addressed_by_code
        ? "O interlocutor usou o CÓDIGO DE CHAMADA: a mensagem é para você."
        : "Modo livre: decida pelo conteúdo se a fala é para você.",
      data.force_persona
        ? `O interlocutor chamou DIRETAMENTE a identidade "${data.force_persona}": responda como ela.`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const { text } = await generateText({ model, system: REPLY_SYSTEM, prompt });
    const parsed = parsePersonaReply(text);
    const persona = data.force_persona ?? parsed.persona;
    const message = parsed.message;
    const addressed = !message.toUpperCase().includes("SILENCIO");
    const { supabase, userId } = context;
    await supabase.from("ai_audit_log").insert({
      user_id: userId,
      table_name: "execution_events",
      action: "live.handover_reply",
      status: "applied",
      payload: { turn: data.turn.slice(0, 2000), output: message, addressed, persona } as never,
    });
    return { message: addressed ? message : "", addressed, persona };
  });

const CHAT_SYSTEM = `Você é a WiMi conversando com o usuário SOBRE O CONTEÚDO COLETADO na sessão ao vivo
(transcrição, registros e logs de jornada do dia). Baseie-se apenas nesse conteúdo e no histórico da conversa.
Se algo não estiver no material, diga que não foi dito. Responda em português, sem markdown,
curto e direto (até 6 frases). Quando pedirem tarefas ou plano, devolva uma lista simples em linhas.

${PERSONA_RULES}
${PERSONA_FORMAT}
Nas listas, use "\n" dentro do campo message.`;

const chatSchema = z.object({
  session_context: z.string().max(12000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .max(20)
    .optional(),
  question: z.string().min(1).max(2000),
  force_persona: z.enum(["wi", "mi"]).optional(),
});

/** (4) Conversa sobre a sessão: contexto = conteúdo coletado. */
export const liveSessionChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => chatSchema.parse(d))
  .handler(async ({ data, context }) => {
    const model = createChatModelWithFallback();
    const history = (data.history ?? [])
      .map((m) => `${m.role === "user" ? "Usuário" : "WiMi"}: ${m.text}`)
      .join("\n");
    const prompt = [
      `Conteúdo coletado na sessão:\n${data.session_context || "(sem conteúdo coletado)"}`,
      history ? `Conversa até aqui:\n${history}` : "",
      `Pergunta do usuário: ${data.question}`,
      data.force_persona
        ? `O usuário chamou DIRETAMENTE a identidade "${data.force_persona}": responda como ela.`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const { text } = await generateText({ model, system: CHAT_SYSTEM, prompt });
    const parsed = parsePersonaReply(text);
    const persona = data.force_persona ?? parsed.persona;
    const message = parsed.message;
    const { supabase, userId } = context;
    await supabase.from("ai_audit_log").insert({
      user_id: userId,
      table_name: "execution_events",
      action: "live.session_chat",
      status: "applied",
      payload: { question: data.question, output: message, persona } as never,
    });
    return { message, persona };
  });
