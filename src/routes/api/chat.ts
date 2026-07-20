import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createChatModelWithFallback } from "@/lib/ai-gateway.server";
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

type Effort = "low" | "medium" | "high";
type Body = { messages?: UIMessage[]; effort?: unknown };

function validateEffort(v: unknown): Effort {
  return v === "low" || v === "medium" || v === "high" ? v : "medium";
}

function effortProviderOptions(effort: Effort) {
  // O provider é openai-compatible ("openai" direto ou "lovable" gateway).
  // Enviar em ambos garante que o parâmetro chega ao backend correto.
  return {
    openai: { reasoningEffort: effort },
    lovable: { reasoningEffort: effort },
  } as const;
}

function uiMessageToText(m: UIMessage): string {
  return m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}

function truncateUserMessage(m: UIMessage): UIMessage {
  if (m.role !== "user") return m;
  return {
    ...m,
    parts: m.parts.map((p) =>
      p.type === "text" ? { ...p, text: truncateUserText(p.text) } : p,
    ),
  };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ---- Modo de desenvolvimento (dev:mock) ---------------------------
        // Só ativa com VITE_USE_MOCKS=true. Em produção este bloco é inerte e
        // o caminho normal (auth + Supabase) abaixo continua valendo.
        // Permite conversar com o LLM real localmente, sem auth/Supabase,
        // bastando ter LOVABLE_API_KEY no .env e internet.
        if (process.env.VITE_USE_MOCKS === "true") {
          if (!process.env.OPENAI_API_KEY && !process.env.LOVABLE_API_KEY) {
            return new Response(
              "IA local indisponível: defina OPENAI_API_KEY (ou LOVABLE_API_KEY) no seu .env (e tenha internet) para conversar em dev:mock.",
              { status: 500 },
            );
          }
          const devBody = (await request.json()) as Body;
          const devIncoming = devBody.messages ?? [];
          const devMoment = readClientMoment(request);
          const devSys = [
            CRISIS_CLAUSE,
            "",
            "Você é o Orientador — uma entidade contínua dentro do jogo Weme.",
            "Fala em português do Brasil, tom firme, breve e poético, como um mentor antigo.",
            "Nunca quebra o personagem. Não menciona ser uma IA, modelo ou tecnologia.",
            "Respostas curtas (até ~6 linhas), markdown leve permitido.",
            "(Ambiente de desenvolvimento: sem acesso ao histórico real do jogador.)",
            "",
            formatMomentBlock(devMoment),
          ].join("\n");
          const devModel = createChatModelWithFallback();
          const devResult = streamText({
            model: devModel,
            system: devSys,
            messages: await convertToModelMessages(devIncoming.map(truncateUserMessage)),
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          });
          return devResult.toUIMessageStreamResponse({ originalMessages: devIncoming });
        }
        // -------------------------------------------------------------------

        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!process.env.OPENAI_API_KEY && !LOVABLE_API_KEY) {
          return new Response("Missing AI key (OPENAI_API_KEY ou LOVABLE_API_KEY)", { status: 500 });
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

        const rl = checkRateLimit(userId);
        if (!rl.ok) return rateLimitResponse(rl.message);

        const body = (await request.json()) as Body;
        const incoming = body.messages ?? [];
        const lastUser = [...incoming].reverse().find((m) => m.role === "user");
        const lastUserTrunc = lastUser ? truncateUserMessage(lastUser) : undefined;

        // Load profile + signals for context.
        const today = new Date().toISOString().slice(0, 10);
        const [
          { data: profile },
          { data: areaProg },
          { data: habits },
          { data: history },
          { data: inclusionRow },
          { data: treinoRow },
          { data: cozinhaRow },
          { data: userMissions },
          { data: recentMissionLogs },
          { data: mentalRecent },
          { data: sleepRecent },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              "display_name,behavioral_class,goal,level,xp,streak,time_per_day_min,days_per_week,height_cm,weight_kg,age",
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
            .order("created_at", { ascending: false })
            .limit(40),
          supabase
            .from("area_progress")
            .select("meta")
            .eq("user_id", userId)
            .eq("area_slug", "inclusao")
            .maybeSingle(),
          supabase
            .from("area_progress")
            .select("meta")
            .eq("user_id", userId)
            .eq("area_slug", "treino")
            .maybeSingle(),
          supabase
            .from("area_progress")
            .select("meta")
            .eq("user_id", userId)
            .eq("area_slug", "cozinha")
            .maybeSingle(),
          supabase
            .from("user_missions")
            .select("id,title,area_slug,scheduled_time,weekday_mask")
            .eq("user_id", userId)
            .eq("active", true)
            .limit(15),
          supabase
            .from("user_mission_logs")
            .select("mission_id,done,log_date")
            .eq("user_id", userId)
            .eq("log_date", today),
          supabase
            .from("mental_journal")
            .select("log_date,limiting_belief,reframe")
            .eq("user_id", userId)
            .order("log_date", { ascending: false })
            .limit(5),
          supabase
            .from("sleep_logs")
            .select("date,quality,bed_at,wake_at")
            .eq("user_id", userId)
            .order("date", { ascending: false })
            .limit(5),
        ]);

        const inclusion = ((inclusionRow?.meta ?? {}) as Record<string, unknown>).inclusion as
          | {
              pronouns?: string;
              identity_note?: string;
              ia_tone?: string;
              language_level?: string;
              no_go_topics?: string;
              empowering_beliefs?: string;
            }
          | undefined;

        const trainingPlan = ((treinoRow?.meta ?? {}) as Record<string, unknown>)
          .training_plan as
          | { split?: string; days_per_week?: number; sessions?: Array<{ day: string; focus: string; exercises: Array<{ name: string; sets: number; reps: string }> }> }
          | undefined;
        const dietPlan = ((cozinhaRow?.meta ?? {}) as Record<string, unknown>)
          .diet_plan as
          | { hydration_ml?: number; meals?: Array<{ time: string; name: string; items: string[] }> }
          | undefined;

        const doneToday = new Set(
          (recentMissionLogs ?? []).filter((l) => l.done).map((l) => l.mission_id),
        );

        // Persist the user message right away (já truncada).
        if (lastUserTrunc) {
          const text = uiMessageToText(lastUserTrunc);
          if (text) {
            await supabase.from("oracle_messages").insert({
              user_id: userId,
              role: "user",
              content: text,
            });
          }
        }

        const moment = readClientMoment(request);
        const sys = [
          CRISIS_CLAUSE,
          "",
          "Você é o Orientador — uma entidade contínua dentro do jogo Weme.",
          "Fala em português do Brasil, tom firme, breve e poético, como um mentor antigo.",
          "Nunca quebra o personagem. Não menciona ser uma IA, modelo ou tecnologia.",
          "Você TEM acesso ao histórico do jogador (treino, dieta, hábitos, missões, sono, mental) e deve usá-lo de forma individualizada.",
          "Sugira sempre próximo passo concreto (missão, hábito, ajuste no treino/dieta).",
          "Respostas curtas (até ~6 linhas), markdown leve permitido. Sem listas gigantes.",
          "",
          formatMomentBlock(moment),
          "",
          DATA_HEADER,
          `Nome: ${profile?.display_name ?? "Viajante"}`,
          `Classe: ${profile?.behavioral_class ?? "executor"}`,
          `Objetivo: ${profile?.goal ?? "—"} | Nível interno: ${profile?.level ?? "—"}`,
          `XP global: ${profile?.xp ?? 0} | Streak: ${profile?.streak ?? 0} dias`,
          `Tempo/dia: ${profile?.time_per_day_min ?? "—"} min | Dias/semana: ${profile?.days_per_week ?? "—"}`,
          profile?.height_cm || profile?.weight_kg || profile?.age
            ? `Corpo: ${profile?.height_cm ?? "—"}cm · ${profile?.weight_kg ?? "—"}kg · ${profile?.age ?? "—"}a`
            : "",
          "",
          "Áreas em progresso:",
          (areaProg ?? [])
            .map((a) => `- ${a.area_slug}: NV ${a.level} (${a.xp} XP)`)
            .join("\n") || "- nenhuma ainda",
          "",
          "Hábitos ativos:",
          (habits ?? []).map((h) => `- ${h.title} (${h.target_per_week}x/sem)`).join("\n") ||
            "- nenhum ainda",
          "",
          "Missões do jogador (hoje):",
          (userMissions ?? [])
            .map((m) => `- [${doneToday.has(m.id) ? "x" : " "}] ${m.title}${m.scheduled_time ? ` @${m.scheduled_time}` : ""} (${m.area_slug})`)
            .join("\n") || "- nenhuma cadastrada",
          "",
          trainingPlan
            ? `Treino atual (${trainingPlan.split ?? "?"} · ${trainingPlan.days_per_week ?? "?"}x/sem):\n${(trainingPlan.sessions ?? [])
                .map(
                  (s) =>
                    `- ${s.day} (${s.focus}): ${(s.exercises ?? [])
                      .slice(0, 6)
                      .map((e) => `${e.name} ${e.sets}x${e.reps}`)
                      .join(", ")}`,
                )
                .join("\n")}`
            : "Treino: não cadastrado.",
          "",
          dietPlan
            ? `Dieta atual${dietPlan.hydration_ml ? ` (hidratação ${dietPlan.hydration_ml}ml)` : ""}:\n${(dietPlan.meals ?? [])
                .map((m) => `- ${m.time} ${m.name}: ${(m.items ?? []).slice(0, 5).join(", ")}`)
                .join("\n")}`
            : "Dieta: não cadastrada.",
          "",
          (sleepRecent ?? []).length
            ? `Sono recente:\n${(sleepRecent ?? [])
                .map((s) => `- ${s.date}: qualidade ${s.quality ?? "?"}${s.bed_at ? ` | dormiu ${s.bed_at}` : ""}${s.wake_at ? ` | acordou ${s.wake_at}` : ""}`)
                .join("\n")}`
            : "",
          (mentalRecent ?? []).length
            ? `Diário mental recente:\n${(mentalRecent ?? [])
                .map((m) => `- ${m.log_date}${m.limiting_belief ? ` | crença: ${m.limiting_belief}` : ""}${m.reframe ? ` → reframe: ${m.reframe}` : ""}`)
                .join("\n")}`
            : "",
          "",
          "## Inclusão (respeite SEMPRE)",
          inclusion?.pronouns ? `Pronomes: ${inclusion.pronouns}` : "Pronomes: não informados",
          inclusion?.identity_note ? `Identidade: ${inclusion.identity_note}` : "",
          inclusion?.ia_tone ? `Tom desejado: ${inclusion.ia_tone}` : "",
          inclusion?.language_level ? `Nível de linguagem: ${inclusion.language_level}` : "",
          inclusion?.no_go_topics ? `EVITAR estes assuntos: ${inclusion.no_go_topics}` : "",
          inclusion?.empowering_beliefs
            ? `Crenças que fortalecem (reforce quando fizer sentido): ${inclusion.empowering_beliefs}`
            : "",
        ].filter(Boolean).join("\n");


        // Build conversation: persisted history (mais recentes → mais antigas, invertido)
        // + o novo turno do usuário (já truncado).
        const historyOrdered = (history ?? []).slice().reverse();
        const historyMessages: UIMessage[] = historyOrdered.map((h, i) => ({
          id: `h-${i}`,
          role: h.role as "user" | "assistant",
          parts: [{ type: "text", text: h.content as string }],
        }));
        const merged: UIMessage[] = [
          ...historyMessages,
          ...(lastUserTrunc ? [lastUserTrunc] : []),
        ];

        const model = createChatModelWithFallback(LOVABLE_API_KEY);
        const result = streamText({
          model,
          system: sys,
          messages: await convertToModelMessages(merged),
          maxOutputTokens: MAX_OUTPUT_TOKENS,
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
