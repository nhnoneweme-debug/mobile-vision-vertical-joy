import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/wake-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7);

        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!LOVABLE_API_KEY) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          },
        );
        const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
        if (cErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });
        const userId = claims.claims.sub as string;

        const { messages, sessionId } = (await request.json()) as {
          messages: UIMessage[];
          sessionId?: string;
        };

        const [{ data: profile }, { data: session }] = await Promise.all([
          supabase
            .from("profiles")
            .select("display_name,behavioral_class,goal,streak,time_per_day_min")
            .eq("id", userId)
            .maybeSingle(),
          sessionId
            ? supabase
                .from("wake_sessions")
                .select("*")
                .eq("id", sessionId)
                .eq("user_id", userId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        const sys = [
          "Você é a Companheira do Despertar — entidade contínua, voz quente e firme.",
          "Conduza o usuário de dormir a acordar com gentileza, sem moralismo.",
          "Negocie snooze com inteligência (5/10/20 min) usando as ferramentas disponíveis.",
          "Quando ele acordar, ofereça registrar o sonho. Depois, sugira o primeiro bloco do dia.",
          "Respostas curtas (1-3 linhas), pt-BR, markdown leve.",
          "",
          `Nome: ${profile?.display_name ?? "Viajante"} | Classe: ${profile?.behavioral_class ?? "—"}`,
          `Objetivo: ${profile?.goal ?? "—"} | Streak: ${profile?.streak ?? 0}`,
          session
            ? `Sessão atual: status=${session.status}, snoozes=${session.snooze_count}, total ${session.total_snooze_min}min`
            : "Sem sessão ativa.",
        ].join("\n");

        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
        const model = gateway("google/gemini-3-flash-preview");

        const tools = {
          setSnooze: tool({
            description: "Agenda um snooze (em minutos). Use entre 5 e 20 conforme a interação.",
            inputSchema: z.object({ minutes: z.number().int().min(1).max(60) }),
            execute: async ({ minutes }) => {
              if (!sessionId) return { ok: false, reason: "no_session" };
              const { data: s } = await supabase
                .from("wake_sessions")
                .select("snooze_count,total_snooze_min")
                .eq("id", sessionId)
                .single();
              const next = {
                status: "snoozing" as const,
                snooze_count: (s?.snooze_count ?? 0) + 1,
                total_snooze_min: (s?.total_snooze_min ?? 0) + minutes,
              };
              await supabase.from("wake_sessions").update(next).eq("id", sessionId);
              await supabase
                .from("wake_events")
                .insert({ session_id: sessionId, user_id: userId, kind: "snooze", payload: { minutes } });
              return { ok: true, minutes, next_ring_at: new Date(Date.now() + minutes * 60_000).toISOString() };
            },
          }),
          playMusic: tool({
            description: "Toca uma trilha curta no humor pedido (calm | energy | focus).",
            inputSchema: z.object({ mood: z.enum(["calm", "energy", "focus"]) }),
            execute: async ({ mood }) => {
              if (sessionId)
                await supabase
                  .from("wake_events")
                  .insert({ session_id: sessionId, user_id: userId, kind: "music", payload: { mood } });
              return { ok: true, mood };
            },
          }),
          speakThought: tool({
            description: "Entrega um pensamento curto do dia ao usuário (frase poética, pt-BR).",
            inputSchema: z.object({ text: z.string().min(1).max(280) }),
            execute: async ({ text }) => {
              if (sessionId)
                await supabase
                  .from("wake_events")
                  .insert({ session_id: sessionId, user_id: userId, kind: "thought", payload: { text } });
              return { ok: true };
            },
          }),
          markAwake: tool({
            description: "Marca o usuário como acordado e encerra a sessão de despertar.",
            inputSchema: z.object({ mood: z.string().optional() }),
            execute: async ({ mood }) => {
              if (!sessionId) return { ok: false };
              await supabase
                .from("wake_sessions")
                .update({ status: "awake", woke_at: new Date().toISOString(), mood_on_wake: mood ?? null })
                .eq("id", sessionId);
              await supabase
                .from("wake_events")
                .insert({ session_id: sessionId, user_id: userId, kind: "wake", payload: { mood } });
              await supabase.from("day_blocks").insert({
                user_id: userId,
                kind: "wake",
                started_at: new Date().toISOString(),
                completed: true,
              });
              return { ok: true };
            },
          }),
          logDream: tool({
            description:
              "Registra um sonho relatado pelo usuário. Extraia símbolos e temas em arrays curtos.",
            inputSchema: z.object({
              raw_text: z.string().min(1),
              mood: z.string().optional(),
              lucidity: z.number().int().min(0).max(10).optional(),
              symbols: z.array(z.string()).optional(),
              themes: z.array(z.string()).optional(),
              ai_summary: z.string().optional(),
              ai_interpretation: z.string().optional(),
            }),
            execute: async (input) => {
              const { data, error } = await supabase
                .from("dream_logs")
                .insert({
                  user_id: userId,
                  session_id: sessionId ?? null,
                  raw_text: input.raw_text,
                  mood: input.mood ?? null,
                  lucidity: input.lucidity ?? null,
                  symbols: input.symbols ?? [],
                  themes: input.themes ?? [],
                  ai_summary: input.ai_summary ?? null,
                  ai_interpretation: input.ai_interpretation ?? null,
                })
                .select("id")
                .single();
              if (error) return { ok: false, error: error.message };
              if (sessionId)
                await supabase.from("wake_sessions").update({ dream_logged: true }).eq("id", sessionId);
              return { ok: true, id: data.id };
            },
          }),
          createDayBlock: tool({
            description: "Inicia um bloco do dia (cozinha, exercício, trabalho, etc).",
            inputSchema: z.object({
              kind: z.enum(["wake", "dream", "kitchen", "move", "deep_work", "family", "wind_down", "sleep"]),
              notes: z.string().optional(),
            }),
            execute: async ({ kind, notes }) => {
              const { data, error } = await supabase
                .from("day_blocks")
                .insert({ user_id: userId, kind, started_at: new Date().toISOString(), notes: notes ?? null })
                .select("id")
                .single();
              if (error) return { ok: false, error: error.message };
              return { ok: true, id: data.id };
            },
          }),
        } as const;

        const result = streamText({
          model,
          system: sys,
          messages: await convertToModelMessages(messages),
          tools,
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
