import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createChatModelWithFallback } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";
import {
  ACTION_TO_TABLE,
  ALLOWED_ACTIONS,
  type AllowedAction,
  type Proposal,
} from "@/lib/ia-capture";
import { AUTO_APPLY_ACTIONS, applyAction } from "@/lib/ia-capture-apply";
import {
  CRISIS_CLAUSE,
  DATA_HEADER,
  MAX_OUTPUT_TOKENS,
  checkRateLimit,
  rateLimitResponse,
  truncateUserText,
} from "@/lib/ai-guardrails.server";

type ChatMsg = { role: "user" | "assistant"; content: string };
type Body = { session_id?: string | null; messages: ChatMsg[] };

export const Route = createFileRoute("/api/ia-capture")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!process.env.OPENAI_API_KEY && !LOVABLE_API_KEY) return new Response("Missing AI key", { status: 500 });

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const { data: claims, error: cerr } = await supabase.auth.getClaims(token);
        if (cerr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });
        const userId = claims.claims.sub as string;

        const rl = checkRateLimit(userId);
        if (!rl.ok) return rateLimitResponse(rl.message);

        const body = (await request.json()) as Body;
        const rawMessages = (body.messages ?? []).filter(
          (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
        );
        const messages = rawMessages.map((m) => ({
          ...m,
          content: m.role === "user" ? truncateUserText(m.content) : m.content,
        }));

        // Ensure / create session.
        let sessionId = body.session_id ?? null;
        if (!sessionId) {
          const { data: s } = await supabase
            .from("ai_capture_sessions")
            .insert({ user_id: userId, title: messages[0]?.content?.slice(0, 60) ?? null })
            .select("id")
            .single();
          sessionId = s?.id ?? null;
        }

        // Load context for the model.
        const [{ data: profile }, { data: habits }, { data: areas }] = await Promise.all([
          supabase
            .from("profiles")
            .select("display_name,behavioral_class,goal,xp,streak,time_per_day_min,days_per_week,level_track")
            .eq("id", userId)
            .maybeSingle(),
          supabase.from("habits").select("title,target_per_week,active").eq("user_id", userId).limit(20),
          supabase
            .from("area_progress")
            .select("area_slug,level,xp")
            .eq("user_id", userId)
            .order("xp", { ascending: false })
            .limit(10),
        ]);

        const proposals: Proposal[] = [];

        const propose = tool({
          description:
            "Propõe uma escrita no banco de dados do jogador. NÃO grava direto; cria um registro PENDENTE de auditoria para o usuário confirmar.",
          inputSchema: z.object({
            action: z.enum(ALLOWED_ACTIONS as [AllowedAction, ...AllowedAction[]]),
            summary: z.string().describe("Resumo curto em português do que será feito."),
            payload: z
              .record(z.string(), z.unknown())
              .describe("Campos da escrita. Veja exemplos no system prompt."),
          }),
          execute: async ({ action, summary, payload }) => {
            const typedAction = action as AllowedAction;
            const table = ACTION_TO_TABLE[typedAction];
            const { data, error } = await supabase
              .from("ai_audit_log")
              .insert({
                user_id: userId,
                session_id: sessionId,
                table_name: table,
                action,
                payload: payload as never,
                status: "pending",
                reason: summary,
              })
              .select("id")
              .single();
            if (error || !data) return { ok: false, error: error?.message ?? "audit_insert_failed" };

            let autoApplied = false;
            let applyError: string | undefined;
            if (AUTO_APPLY_ACTIONS.has(typedAction)) {
              try {
                const res = await applyAction(supabase, userId, typedAction, payload);
                await supabase
                  .from("ai_audit_log")
                  .update({
                    status: "applied",
                    payload: {
                      ...payload,
                      _inserted_table: res.inserted_table,
                      _inserted_id: res.inserted_id,
                    } as never,
                  })
                  .eq("id", data.id);
                autoApplied = true;
              } catch (err) {
                applyError = err instanceof Error ? err.message : "apply_failed";
                await supabase
                  .from("ai_audit_log")
                  .update({ status: "error", reason: applyError })
                  .eq("id", data.id);
              }
            }

            proposals.push({
              audit_id: data.id,
              action: typedAction,
              table,
              payload,
              summary,
              auto_applied: autoApplied,
              apply_error: applyError,
            });
            return { ok: true, audit_id: data.id, auto_applied: autoApplied };
          },
        });

        const sys = [
          CRISIS_CLAUSE,
          "",
          "Você é a IA-Coletora do Personal IA — uma mentora que ESCUTA dumps do jogador (texto, áudio ou vídeo transcritos) e ORGANIZA os dados nas estruturas do jogo.",
          "Português do Brasil, tom firme e breve. NÃO peça que o jogador preencha formulários — você extrai e propõe as escritas.",
          "Use a ferramenta `propose_writes` SEMPRE que identificar algo que deva virar registro. Cada chamada cria uma PROPOSTA pendente que o jogador confirma ou rejeita.",
          "Depois das propostas, escreva UMA mensagem curta (até 4 linhas) confirmando o que vai registrar e perguntando o que falta. NUNCA invente IDs.",
          "",
          "## Esquema das actions (use exatamente esses campos no payload):",
          "- habit.create → { title:string, target_per_week:number (1-7), area?:string }",
          "- habit_log.today → { habit_title:string } (procura/cria hábito pelo título e marca hoje)",
          "- quest.create → { title:string, xp_reward?:number=25 } (missão para hoje)",
          "- ritual.upsert → { ritual_type:'morning'|'night', content:string }",
          "- goal.create → { title:string, horizon:'week'|'month'|'quarter'|'year', target_date?:YYYY-MM-DD }",
          "- scheduled_quest.create → { title:string, scheduled_for:YYYY-MM-DD }",
          "- area_mission.complete → { area_slug:string, mission_id:uuid }",
          "- profile.update → { display_name?, goal?, time_per_day_min?, days_per_week?, height_cm?, weight_kg?, age?, level_track? }",
          "",
          "## Comportamento de gravação",
          "Ações de BAIXO RISCO são salvas automaticamente, sem pedir confirmação: habit.create, habit_log.today, quest.create, ritual.upsert, scheduled_quest.create, area_mission.complete.",
          "Apenas profile.update e goal.create exigem confirmação do usuário.",
          "Quando salvar algo automaticamente, diga o que foi salvo de forma curta (1 linha por item).",
          "",
          DATA_HEADER,
          `Nome: ${profile?.display_name ?? "Viajante"} · Classe: ${profile?.behavioral_class ?? "—"} · Trilha: ${profile?.level_track ?? "—"}`,
          `Objetivo: ${profile?.goal ?? "—"} · XP: ${profile?.xp ?? 0} · Streak: ${profile?.streak ?? 0}`,
          `Tempo/dia: ${profile?.time_per_day_min ?? "—"}min · Dias/sem: ${profile?.days_per_week ?? "—"}`,
          "Hábitos ativos: " +
            ((habits ?? []).filter((h) => h.active).map((h) => `${h.title}(${h.target_per_week}x)`).join(", ") || "—"),
          "Áreas top: " + ((areas ?? []).map((a) => `${a.area_slug} NV${a.level}`).join(", ") || "—"),
        ].join("\n");

        const model = createChatModelWithFallback(LOVABLE_API_KEY);

        try {
          const result = await generateText({
            model,
            system: sys,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            tools: { propose_writes: propose },
            stopWhen: stepCountIs(10),
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          });

          const text = result.text || (proposals.length ? "Propostas geradas. Confirme abaixo." : "Pronto.");

          // Persist conversation snapshot on the session.
          if (sessionId) {
            const newMessages = [
              ...messages,
              { role: "assistant" as const, content: text },
            ];
            await supabase
              .from("ai_capture_sessions")
              .update({
                messages: newMessages,
                last_message_at: new Date().toISOString(),
                writes_count: (proposals.length || 0),
              })
              .eq("id", sessionId);
          }

          return Response.json({ session_id: sessionId, text, proposals });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "ai_error";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
