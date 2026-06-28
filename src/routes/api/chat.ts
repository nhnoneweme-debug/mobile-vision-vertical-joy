import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

type Body = { messages?: UIMessage[] };

function uiMessageToText(m: UIMessage): string {
  return m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!LOVABLE_API_KEY) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claims.claims.sub as string;

        const body = (await request.json()) as Body;
        const incoming = body.messages ?? [];
        const lastUser = [...incoming].reverse().find((m) => m.role === "user");

        // Load profile + signals for context.
        const [{ data: profile }, { data: areaProg }, { data: habits }, { data: history }] =
          await Promise.all([
            supabase
              .from("profiles")
              .select(
                "display_name,behavioral_class,goal,level,xp,streak,time_per_day_min,days_per_week",
              )
              .eq("id", userId)
              .maybeSingle(),
            supabase
              .from("area_progress")
              .select("area_slug,level,xp")
              .eq("user_id", userId)
              .order("xp", { ascending: false })
              .limit(10),
            supabase
              .from("habits")
              .select("title,target_per_week")
              .eq("user_id", userId)
              .eq("active", true)
              .limit(10),
            supabase
              .from("oracle_messages")
              .select("role,content")
              .eq("user_id", userId)
              .order("created_at", { ascending: true })
              .limit(40),
          ]);

        // Persist the user message right away.
        if (lastUser) {
          const text = uiMessageToText(lastUser);
          if (text) {
            await supabase.from("oracle_messages").insert({
              user_id: userId,
              role: "user",
              content: text,
            });
          }
        }

        const sys = [
          "Você é o Orientador — uma entidade contínua dentro do jogo Personal IA.",
          "Fala em português do Brasil, tom firme, breve e poético, como um mentor antigo.",
          "Nunca quebra o personagem. Não menciona ser uma IA, modelo ou tecnologia.",
          "Usa o contexto do jogador para sugerir próximos passos concretos (missões, hábitos, áreas).",
          "Respostas curtas (até ~6 linhas), markdown leve permitido. Sem listas gigantes.",
          "",
          "## Contexto do jogador",
          `Nome: ${profile?.display_name ?? "Viajante"}`,
          `Classe: ${profile?.behavioral_class ?? "executor"}`,
          `Objetivo: ${profile?.goal ?? "—"} | Nível interno: ${profile?.level ?? "—"}`,
          `XP global: ${profile?.xp ?? 0} | Streak: ${profile?.streak ?? 0} dias`,
          `Tempo/dia: ${profile?.time_per_day_min ?? "—"} min | Dias/semana: ${profile?.days_per_week ?? "—"}`,
          "",
          "Áreas em progresso:",
          (areaProg ?? [])
            .map((a) => `- ${a.area_slug}: NV ${a.level} (${a.xp} XP)`)
            .join("\n") || "- nenhuma ainda",
          "",
          "Hábitos ativos:",
          (habits ?? []).map((h) => `- ${h.title} (${h.target_per_week}x/sem)`).join("\n") ||
            "- nenhum ainda",
        ].join("\n");

        // Build conversation: persisted history + the new incoming user turn.
        const historyMessages: UIMessage[] = (history ?? []).map((h, i) => ({
          id: `h-${i}`,
          role: h.role as "user" | "assistant",
          parts: [{ type: "text", text: h.content as string }],
        }));
        const merged: UIMessage[] = [
          ...historyMessages,
          ...(lastUser ? [lastUser] : []),
        ];

        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
        const model = gateway("google/gemini-3-flash-preview");
        const result = streamText({
          model,
          system: sys,
          messages: await convertToModelMessages(merged),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: incoming,
          onFinish: async ({ responseMessage }) => {
            const text = uiMessageToText(responseMessage as UIMessage);
            if (text) {
              await supabase.from("oracle_messages").insert({
                user_id: userId,
                role: "assistant",
                content: text,
              });
            }
          },
        });
      },
    },
  },
});
