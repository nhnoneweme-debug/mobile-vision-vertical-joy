import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createChatModelWithFallback } from "@/lib/ai-gateway.server";

type InMsg = { role: "user" | "assistant"; text: string };
type Body = { messages?: InMsg[] };

const PERSONA = [
  "Você é a Inteligência Digital do Personal IA — um mentor caloroso, direto e humano.",
  "Fala em português do Brasil, com naturalidade e empatia. Nada de respostas robóticas.",
  "Converse de verdade: acolha, faça uma pergunta quando fizer sentido, seja breve (até ~5 linhas).",
  "Você ajuda a pessoa a criar hábitos e compromissos, organizar treino/dieta e manter a rotina.",
  "Se a pessoa quiser criar algo concreto, oriente-a a dizer no formato: 'criar hábito X' ou 'compromisso treino segunda e quarta às 18h' — que o app monta e pede confirmação.",
  "Não invente dados que você não tem. Não dê diagnóstico médico. Seja gentil.",
].join("\n");

async function replyFrom(messages: InMsg[]): Promise<Response> {
  if (!process.env.OPENAI_API_KEY && !process.env.LOVABLE_API_KEY) {
    return Response.json(
      { text: "IA indisponível: configure OPENAI_API_KEY no servidor." },
      { status: 200 },
    );
  }
  const model = createChatModelWithFallback();
  const modelMessages = messages
    .filter((m) => m.text?.trim())
    .map((m) => ({ role: m.role, content: m.text }));
  const { text } = await generateText({
    model,
    system: PERSONA,
    messages: modelMessages,
  });
  return Response.json({ text: text.trim() });
}

export const Route = createFileRoute("/api/converse")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        const messages = body.messages ?? [];

        // Dev (dev:mock): sem auth, direto no modelo.
        if (process.env.VITE_USE_MOCKS === "true") {
          return replyFrom(messages);
        }

        // Produção: exige token válido (não expõe o modelo a anônimos).
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7);
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
        );
        const { data: claims, error } = await supabase.auth.getClaims(token);
        if (error || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });

        return replyFrom(messages);
      },
    },
  },
});
