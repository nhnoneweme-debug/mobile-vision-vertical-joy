// STUDIO DE PERSONAS — prévia: dada uma pergunta e o modelo em edição, mostra
// QUAL identidade responderia e COM QUE TOM, antes de salvar.

import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createChatModelWithFallback } from "@/lib/ai-gateway.server";
import { ambientBlock } from "@/lib/client-moment.server";

const previewSchema = z.object({
  directive: z.string().min(1).max(3000),
  question: z.string().min(1).max(1000),
});

const SYSTEM = `Você é o simulador do par WiMi. Recebe o MODELO DE PERSONAS configurado pelo
usuário e uma pergunta de teste. Aplique o modelo à risca (roteamento, proporção, intensidade,
extensão e postura) e devolve como a manifestação sairia.

IDIOMA: responda no MESMO IDIOMA da pergunta de teste e informe-o em "reply_lang".

FORMATO OBRIGATÓRIO: apenas JSON válido, sem markdown:
{"persona":"wi"|"mi","reply_lang":"pt-BR"|"en-US"|"es-ES","message":"a fala como sairia",
 "why":"uma frase explicando por que essa identidade foi escolhida, segundo as regras"}`;

export const personaPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => previewSchema.parse(d))
  .handler(async ({ data }) => {
    const model = createChatModelWithFallback();
    const { text } = await generateText({
      model,
      system: `${SYSTEM}\n\n${ambientBlock()}`,
      prompt: `MODELO DE PERSONAS:\n${data.directive}\n\nPergunta de teste:\n${data.question}`,
    });
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const o = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
        const message = typeof o["message"] === "string" ? o["message"].trim() : "";
        if (message)
          return {
            persona: o["persona"] === "mi" ? ("mi" as const) : ("wi" as const),
            reply_lang: typeof o["reply_lang"] === "string" ? o["reply_lang"] : null,
            message,
            why: typeof o["why"] === "string" ? o["why"] : "",
          };
      } catch {
        /* fallback textual */
      }
    }
    return { persona: "wi" as const, reply_lang: null, message: cleaned, why: "" };
  });
