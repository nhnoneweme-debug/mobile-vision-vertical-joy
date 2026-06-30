import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/sleep-chat")({
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

        const { messages } = (await request.json()) as { messages: UIMessage[] };
        const today = new Date().toISOString().slice(0, 10);

        const [{ data: profile }, { data: blocks }, { data: sleep }] = await Promise.all([
          supabase
            .from("profiles")
            .select("display_name,behavioral_class,goal,streak")
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("day_blocks")
            .select("kind,completed,started_at")
            .eq("user_id", userId)
            .eq("date", today)
            .order("started_at"),
          supabase
            .from("sleep_logs")
            .select("*")
            .eq("user_id", userId)
            .eq("date", today)
            .maybeSingle(),
        ]);

        const sys = [
          "Você é a Companheira do Sono — voz quente, calma, presente.",
          "Conduza o ritual da noite: escute como foi o dia, faça perguntas curtas pra extrair fatos,",
          "e organize os dados no banco usando as ferramentas. O usuário faz o DUMP, você organiza.",
          "Sequência sugerida: 1) Como foi o dia? 2) O que ficou pesado? 3) O que foi vitória?",
          "4) Algo pra registrar (hábito feito, ideia, gratidão)? 5) Intenção/reflexão da noite (use saveNightRitual).",
          "6) Hora de dormir prevista (use logSleep).",
          "Sempre que detectar algo registrável (hábito completado, missão futura, meta, ideia), chame a tool correspondente — sem pedir confirmação pra cada item, só resuma no fim.",
          "Respostas curtas (1-3 linhas), pt-BR, markdown leve, tom mentor próximo.",
          "",
          `Nome: ${profile?.display_name ?? "Viajante"} | Classe: ${profile?.behavioral_class ?? "—"} | Streak: ${profile?.streak ?? 0}`,
          `Blocos do dia hoje: ${(blocks ?? []).map((b) => `${b.kind}${b.completed ? "✓" : "·"}`).join(", ") || "nenhum"}`,
          sleep ? `Sleep log de hoje: bed=${sleep.bed_at ?? "—"} quality=${sleep.quality ?? "—"}` : "Ainda sem sleep log hoje.",
        ].join("\n");

        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
        const model = gateway("google/gemini-3-flash-preview");

        const tools = {
          saveNightRitual: tool({
            description:
              "Salva o ritual da noite com a reflexão/dump do dia organizada. Use após escutar como foi o dia.",
            inputSchema: z.object({
              intention: z.string().optional(),
              reflections: z
                .object({
                  highlights: z.string().optional(),
                  challenges: z.string().optional(),
                  gratitude: z.string().optional(),
                  tomorrow: z.string().optional(),
                  note: z.string().optional(),
                })
                .partial()
                .default({}),
            }),
            execute: async ({ intention, reflections }) => {
              const { error } = await supabase.from("ritual_logs").upsert(
                {
                  user_id: userId,
                  ritual_date: today,
                  ritual_type: "night",
                  intention: intention ?? null,
                  reflections: reflections ?? {},
                },
                { onConflict: "user_id,ritual_date,ritual_type" },
              );
              if (error) return { ok: false, error: error.message };
              return { ok: true };
            },
          }),
          logSleep: tool({
            description: "Registra o sleep_log de hoje (cama, dormir, qualidade prevista).",
            inputSchema: z.object({
              bed_at: z.string().optional().describe("ISO datetime quando foi pra cama"),
              sleep_at: z.string().optional(),
              quality: z.number().int().min(1).max(5).optional(),
              ritual_done: z.boolean().optional(),
              notes: z.string().optional(),
            }),
            execute: async (input) => {
              const { error } = await supabase.from("sleep_logs").upsert(
                {
                  user_id: userId,
                  date: today,
                  bed_at: input.bed_at ?? null,
                  sleep_at: input.sleep_at ?? null,
                  quality: input.quality ?? null,
                  ritual_done: input.ritual_done ?? true,
                  notes: input.notes ?? null,
                },
                { onConflict: "user_id,date" },
              );
              if (error) return { ok: false, error: error.message };
              return { ok: true };
            },
          }),
          createDayBlock: tool({
            description: "Marca um bloco — útil para wind_down (preparação) ou sleep (encerramento).",
            inputSchema: z.object({
              kind: z.enum(["wind_down", "sleep"]),
              notes: z.string().optional(),
            }),
            execute: async ({ kind, notes }) => {
              const { error } = await supabase.from("day_blocks").insert({
                user_id: userId,
                kind,
                started_at: new Date().toISOString(),
                completed: kind === "sleep" ? false : true,
                notes: notes ?? null,
              });
              if (error) return { ok: false, error: error.message };
              return { ok: true };
            },
          }),
          logCompletedHabit: tool({
            description:
              "Registra que um hábito foi completado hoje. Se o hábito não existir, cria automaticamente.",
            inputSchema: z.object({ habit_title: z.string().min(1) }),
            execute: async ({ habit_title }) => {
              let { data: h } = await supabase
                .from("habits")
                .select("id")
                .eq("user_id", userId)
                .ilike("title", habit_title)
                .maybeSingle();
              if (!h) {
                const { data: created, error } = await supabase
                  .from("habits")
                  .insert({
                    user_id: userId,
                    title: habit_title,
                    target_per_week: 3,
                    active: true,
                    area_slug: "geral",
                    icon: "flame",
                  })
                  .select("id")
                  .single();
                if (error) return { ok: false, error: error.message };
                h = created;
              }
              const { error } = await supabase.from("habit_logs").insert({
                habit_id: h!.id,
                user_id: userId,
                log_date: today,
                status: "completed",
              });
              if (error) return { ok: false, error: error.message };
              return { ok: true };
            },
          }),
          scheduleTomorrowQuest: tool({
            description: "Agenda uma missão pra amanhã (ou data específica).",
            inputSchema: z.object({
              title: z.string().min(1),
              scheduled_date: z.string().optional(),
            }),
            execute: async ({ title, scheduled_date }) => {
              const d =
                scheduled_date ??
                new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);
              const { error } = await supabase.from("scheduled_quests").insert({
                user_id: userId,
                title,
                scheduled_date: d,
                status: "pending",
              });
              if (error) return { ok: false, error: error.message };
              return { ok: true, scheduled_date: d };
            },
          }),
          captureInsight: tool({
            description:
              "Loga uma ideia/insight/gratidão do usuário num log de auditoria pra revisitar depois.",
            inputSchema: z.object({
              kind: z.enum(["idea", "gratitude", "worry", "win"]),
              text: z.string().min(1),
            }),
            execute: async ({ kind, text }) => {
              const { error } = await supabase.from("ai_audit_log").insert({
                user_id: userId,
                action: "insight.capture",
                table_name: "ritual_logs",
                payload: { kind, text, date: today, summary: `${kind}: ${text.slice(0, 80)}` },
                status: "applied",
              });
              if (error) return { ok: false, error: error.message };
              return { ok: true };
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
