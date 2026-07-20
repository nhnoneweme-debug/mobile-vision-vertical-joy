import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createChatModelWithFallback } from "@/lib/ai-gateway.server";
import { assistantName } from "@/lib/assistant-name";
import type { Database } from "@/integrations/supabase/types";
import {
  CRISIS_CLAUSE,
  DATA_HEADER,
  MAX_OUTPUT_TOKENS,
  checkRateLimit,
  rateLimitResponse,
  truncateUserText,
} from "@/lib/ai-guardrails.server";
import { formatMomentBlock, readClientMoment } from "@/lib/client-moment.server";

function truncateUserMessage(m: UIMessage): UIMessage {
  if (m.role !== "user") return m;
  return {
    ...m,
    parts: m.parts.map((p) => (p.type === "text" ? { ...p, text: truncateUserText(p.text) } : p)),
  };
}

export const Route = createFileRoute("/api/sleep-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7);

        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!process.env.OPENAI_API_KEY && !LOVABLE_API_KEY)
          return new Response("Missing AI key", { status: 500 });

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

        const rl = checkRateLimit(userId);
        if (!rl.ok) return rateLimitResponse(rl.message);

        const body = (await request.json()) as { messages: UIMessage[]; mode?: string };
        // Mesmo ritual, dois lados do sono: manhã organiza o sonho, noite o dia.
        const mode: "morning" | "night" = body.mode === "morning" ? "morning" : "night";
        const safeMessages = body.messages.map(truncateUserMessage);
        const today = new Date().toISOString().slice(0, 10);

        const [{ data: profile }, { data: blocks }, { data: sleep }, { data: cfg }] =
          await Promise.all([
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
            supabase
              .from("chat_settings")
              .select("assistant_name")
              .eq("user_id", userId)
              .maybeSingle(),
          ]);

        // O nome da IA é do usuário e vale em todas as telas, não só no chat principal.
        const nome = assistantName(cfg);

        const ritualSteps =
          mode === "morning"
            ? [
                `Seu nome é ${nome} — a inteligência digital do Weme. Aqui você conduz o despertar: voz quente, calma, sem pressa.`,
                "Conduza o ritual da manhã: o sonho escapa rápido, então PRIMEIRO capture o sonho cru,",
                "só depois organize. O usuário faz o DUMP (muitas vezes falando, torto e sem ordem), você organiza.",
                "Sequência sugerida: 1) O que lembra do sonho? 2) Puxe detalhes que estejam escapando",
                "(pessoas, lugares, sensação) — perguntas curtas, uma de cada vez. 3) Chame logDream com o",
                "texto cru + símbolos/temas/sensação que você extraiu. 4) Como acordou (use logWake).",
                "5) Intenção do dia (use saveMorningRitual).",
                "Se disser que não lembra do sonho, não insista: siga pro resto do ritual.",
                "Ao interpretar um sonho, seja sóbria — hipótese ligada à vida real da pessoa, nunca misticismo ou determinismo.",
              ]
            : [
                `Seu nome é ${nome} — a inteligência digital do Weme. Aqui você conduz a noite: voz quente, calma, presente.`,
                "Conduza o ritual da noite: escute como foi o dia, faça perguntas curtas pra extrair fatos,",
                "e organize os dados no banco usando as ferramentas. O usuário faz o DUMP, você organiza.",
                "Sequência sugerida: 1) Como foi o dia? 2) O que ficou pesado? 3) O que foi vitória?",
                "4) Algo pra registrar (hábito feito, ideia, gratidão)? 5) Intenção/reflexão da noite (use saveNightRitual).",
                "6) Hora de dormir prevista (use logSleep).",
              ];

        const sleepMoment = readClientMoment(request);
        const sys = [
          CRISIS_CLAUSE,
          "",
          ...ritualSteps,
          "Sempre que detectar algo registrável (hábito completado, missão futura, meta, ideia), chame a tool correspondente — sem pedir confirmação pra cada item, só resuma no fim.",
          "O texto pode vir de transcrição de voz: tolere frases quebradas, repetição e erro de reconhecimento — entenda a intenção e não corrija a pessoa.",
          "Respostas curtas (1-3 linhas), pt-BR, markdown leve, tom mentor próximo.",
          "",
          formatMomentBlock(sleepMoment),
          "",
          DATA_HEADER,
          `Nome: ${profile?.display_name ?? "Viajante"} | Classe: ${profile?.behavioral_class ?? "—"} | Streak: ${profile?.streak ?? 0}`,
          `Blocos do dia hoje: ${(blocks ?? []).map((b) => `${b.kind}${b.completed ? "✓" : "·"}`).join(", ") || "nenhum"}`,
          sleep
            ? `Sleep log de hoje: bed=${sleep.bed_at ?? "—"} wake=${sleep.wake_at ?? "—"} quality=${sleep.quality ?? "—"}`
            : "Ainda sem sleep log hoje.",
        ].join("\n");

        const model = createChatModelWithFallback(LOVABLE_API_KEY);

        const morningTools = {
          logDream: tool({
            description:
              "Registra o sonho da noite. Chame assim que tiver o relato cru — não espere a pessoa lembrar de tudo. " +
              "Extraia símbolos/temas/sensação do próprio relato; raw_text é o dump como a pessoa contou.",
            inputSchema: z.object({
              raw_text: z.string().min(1).describe("Relato cru do sonho, como a pessoa contou"),
              mood: z.string().optional().describe("Sensação predominante (ex.: ansioso, leve)"),
              lucidity: z.number().int().min(0).max(10).optional(),
              symbols: z
                .array(z.string())
                .optional()
                .describe("Elementos concretos: água, casa, cobra…"),
              themes: z.array(z.string()).optional().describe("Temas: perseguição, reencontro…"),
              ai_summary: z.string().optional().describe("Resumo em 1-2 linhas"),
              ai_interpretation: z
                .string()
                .optional()
                .describe("Hipótese sóbria ligada à vida real da pessoa, sem misticismo"),
            }),
            execute: async (input) => {
              const { error } = await supabase.from("dream_logs").insert({
                user_id: userId,
                raw_text: input.raw_text,
                mood: input.mood ?? null,
                lucidity: input.lucidity ?? null,
                symbols: input.symbols ?? [],
                themes: input.themes ?? [],
                ai_summary: input.ai_summary ?? null,
                ai_interpretation: input.ai_interpretation ?? null,
              });
              if (error) return { ok: false, error: error.message };
              return { ok: true };
            },
          }),
          saveMorningRitual: tool({
            description: "Salva o ritual da manhã: intenção do dia e o que veio do dump.",
            inputSchema: z.object({
              intention: z.string().optional(),
              reflections: z
                .object({
                  dream: z.string().optional(),
                  mood: z.string().optional(),
                  energy: z.string().optional(),
                  focus: z.string().optional(),
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
                  ritual_type: "morning",
                  intention: intention ?? null,
                  reflections: reflections ?? {},
                },
                { onConflict: "user_id,ritual_date,ritual_type" },
              );
              if (error) return { ok: false, error: error.message };
              return { ok: true };
            },
          }),
          logWake: tool({
            description:
              "Registra como a pessoa acordou hoje (hora e qualidade percebida do sono).",
            inputSchema: z.object({
              wake_at: z.string().optional().describe("ISO datetime de quando acordou"),
              quality: z.number().int().min(1).max(5).optional(),
              notes: z.string().optional(),
            }),
            execute: async (input) => {
              const { error } = await supabase.from("sleep_logs").upsert(
                {
                  user_id: userId,
                  date: today,
                  wake_at: input.wake_at ?? new Date().toISOString(),
                  quality: input.quality ?? null,
                  notes: input.notes ?? null,
                },
                { onConflict: "user_id,date" },
              );
              if (error) return { ok: false, error: error.message };
              return { ok: true };
            },
          }),
        } as const;

        const nightTools = {
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
        } as const;

        const sharedTools = {
          createDayBlock: tool({
            description:
              "Marca um bloco do dia — wake/dream de manhã, wind_down (preparação) ou sleep (encerramento) à noite.",
            inputSchema: z.object({
              kind: z.enum([
                "wake",
                "dream",
                "kitchen",
                "move",
                "deep_work",
                "family",
                "wind_down",
                "sleep",
              ]),
              notes: z.string().optional(),
            }),
            execute: async ({ kind, notes }) => {
              const { error } = await supabase.from("day_blocks").insert({
                user_id: userId,
                kind,
                started_at: new Date().toISOString(),
                // "sleep" abre em aberto (a pessoa ainda vai dormir); o resto já aconteceu.
                completed: kind !== "sleep",
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
              const normalized = habit_title.trim().toLowerCase();
              if (!normalized) return { ok: false, error: "titulo_vazio" };
              let { data: h } = await supabase
                .from("habits")
                .select("id")
                .eq("user_id", userId)
                .ilike("title", normalized)
                .maybeSingle();
              if (!h) {
                const { data: created, error } = await supabase
                  .from("habits")
                  .insert({
                    user_id: userId,
                    title: normalized,
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
          scheduleQuest: tool({
            description:
              "Agenda uma missão. Sem data, cai em amanhã — no ritual da manhã, passe a data de hoje para tarefas do próprio dia.",
            inputSchema: z.object({
              title: z.string().min(1),
              scheduled_date: z.string().optional(),
            }),
            execute: async ({ title, scheduled_date }) => {
              const d =
                scheduled_date ?? new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);
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

        // Só expõe as tools do ritual em questão — evita a IA da manhã salvar
        // um ritual da noite (e vice-versa).
        const tools =
          mode === "morning"
            ? { ...morningTools, ...sharedTools }
            : { ...nightTools, ...sharedTools };

        const result = streamText({
          model,
          system: sys,
          messages: await convertToModelMessages(safeMessages),
          tools,
          stopWhen: stepCountIs(10),
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        });

        return result.toUIMessageStreamResponse({ originalMessages: safeMessages });
      },
    },
  },
});
