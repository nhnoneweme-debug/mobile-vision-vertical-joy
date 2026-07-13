import { createFileRoute } from "@tanstack/react-router";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createChatModelWithFallback } from "@/lib/ai-gateway.server";
import {
  CRISIS_CLAUSE,
  DATA_HEADER,
  MAX_OUTPUT_TOKENS,
  checkRateLimit,
  rateLimitResponse,
  truncateUserText,
} from "@/lib/ai-guardrails.server";

type InMsg = { role: "user" | "assistant"; text: string };
type Body = { messages?: InMsg[] };

// Propostas que o agente monta (NÃO grava nada — o usuário confirma no app).
export type Proposal =
  | { id: string; kind: "habito"; data: { titulo: string; frequencia: "diario" | "semanal" | "mensal"; meta?: number; area?: string } }
  | { id: string; kind: "compromisso"; data: { titulo: string; dias_semana?: number[]; horario_inicio?: string; horario_fim?: string; tipo?: "unico" | "diario" | "semanal" } }
  | { id: string; kind: "treino"; data: { nome: string; dias: Array<{ dia: string; foco?: string; exercicios: Array<{ nome: string; series?: number; reps?: string }> }> } }
  | { id: string; kind: "dieta"; data: { nome?: string; hidratacao_ml?: number; refeicoes: Array<{ horario?: string; nome: string; itens: string[] }> } };

const PERSONA = [
  CRISIS_CLAUSE,
  "",
  "Você é a Inteligência Digital do Personal IA — um mentor caloroso, humano e direto, em português do Brasil.",
  "Converse naturalmente, SEM roteiro fixo. Entenda o pedido e só aja quando o usuário pedir algo concreto.",
  "",
  "## Regras firmes",
  "1. OUVIR e ENTENDER. Se faltar informação essencial, PERGUNTE — uma coisa de cada vez, sem interrogatório.",
  "2. NÃO pergunte o que já está no contexto abaixo; use o que já sabemos.",
  "3. Para TREINO ou DIETA, priorize o essencial (objetivo, dias/tempo disponíveis, experiência, lesões, básico de idade/peso/altura). Dados avançados (circunferências, dobras, VO2) são OPCIONAIS: ofereça e pergunte se a pessoa consegue medir, mas NUNCA exija; se não tiver, siga normalmente.",
  "4. Temas sensíveis (ciclo menstrual, medicações) só com tato e se a pessoa quiser; nunca insista; sem diagnóstico médico; não incentive comportamento nocivo (dieta extrema, overtraining).",
  "5. Quando tiver informação suficiente, chame a ferramenta de PROPOR correspondente. Essas ferramentas NÃO criam nada — só montam uma proposta que o usuário revisa e confirma no app.",
  "6. NUNCA diga que criou/agendou/salvou algo. Você só PROPÕE. Quem confirma e cria é o usuário, no app.",
  "7. Uma proposta por vez. Depois de propor, diga em uma frase curta que a proposta está pronta pra revisão/confirmação.",
  "8. Conforme o usuário fornecer fatos (objetivo, disponibilidade, lesões, preferências alimentares…), use registrar_anamnese pra lembrar e não perguntar de novo depois.",
  "9. Respostas curtas e humanas (até ~6 linhas).",
].join("\n");

export const Route = createFileRoute("/api/assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env.OPENAI_API_KEY && !process.env.LOVABLE_API_KEY) {
          return new Response("IA indisponível: configure OPENAI_API_KEY.", { status: 500 });
        }

        const body = (await request.json()) as Body;
        const incoming = body.messages ?? [];
        const isMock = process.env.VITE_USE_MOCKS === "true";

        // Auth + supabase (produção). Em dev:mock, roda só o LLM (sem contexto/persistência).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let supabase: any = null;
        let userId: string | null = null;
        if (!isMock) {
          const auth = request.headers.get("authorization") ?? "";
          if (!auth.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
          const token = auth.slice(7);
          const { createClient } = await import("@supabase/supabase-js");
          supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          });
          const { data: claims, error } = await supabase.auth.getClaims(token);
          if (error || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });
          userId = claims.claims.sub as string;
        }

        const rlKey = userId ?? "dev:mock";
        const rl = checkRateLimit(rlKey);
        if (!rl.ok) return rateLimitResponse(rl.message);

        // Contexto: o que já sabemos (pra não perguntar de novo).
        let contextBlock = "## Contexto\n(ambiente de desenvolvimento — sem dados prévios)";
        if (supabase && userId) {
          try {
            const [{ data: profile }, { data: intake }, { data: habits }, { data: missions }, { data: plans }, { data: area }] =
              await Promise.all([
                supabase.from("profiles").select("display_name,goal,age,weight_kg,height_cm,gender,days_per_week,time_per_day_min,behavioral_class").eq("id", userId).maybeSingle(),
                supabase.from("user_health_intake").select("data").eq("user_id", userId).maybeSingle(),
                supabase.from("habits").select("title").eq("user_id", userId).eq("active", true).limit(20),
                supabase.from("user_missions").select("title").eq("user_id", userId).eq("active", true).limit(20),
                supabase.from("workout_plans").select("name").eq("user_id", userId).limit(10),
                supabase.from("area_progress").select("meta").eq("user_id", userId).eq("area_slug", "cozinha").maybeSingle(),
              ]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hasDiet = !!((area?.meta ?? {}) as any).diet_plan;
            contextBlock = [
              "## O que já sabemos do usuário (NÃO pergunte de novo o que já estiver aqui)",
              `Perfil: ${JSON.stringify(profile ?? {})}`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              `Anamnese salva: ${JSON.stringify((intake as any)?.data ?? {})}`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              `Hábitos ativos: ${((habits ?? []) as any[]).map((h) => h.title).join(", ") || "nenhum"}`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              `Compromissos: ${((missions ?? []) as any[]).map((m) => m.title).join(", ") || "nenhum"}`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              `Planos de treino: ${((plans ?? []) as any[]).map((p) => p.name).join(", ") || "nenhum"}`,
              `Dieta salva: ${hasDiet ? "sim" : "não"}`,
            ].join("\n");
          } catch {
            contextBlock = "## Contexto\n(não consegui carregar os dados prévios)";
          }
        }

        const proposals: Proposal[] = [];
        const uid = () => globalThis.crypto.randomUUID();

        const tools = {
          propor_habito: tool({
            description: "Propõe (NÃO cria) um hábito. Chame só quando tiver título e frequência.",
            inputSchema: z.object({
              titulo: z.string().min(1).max(60),
              frequencia: z.enum(["diario", "semanal", "mensal"]),
              meta: z.number().int().min(1).max(30).optional(),
              area: z.string().max(30).optional(),
            }),
            execute: async (a) => { proposals.push({ id: uid(), kind: "habito", data: a }); return { ok: true }; },
          }),
          propor_compromisso: tool({
            description: "Propõe (NÃO cria) um compromisso/tarefa pra agenda.",
            inputSchema: z.object({
              titulo: z.string().min(1).max(80),
              dias_semana: z.array(z.number().int().min(0).max(6)).max(7).optional(),
              horario_inicio: z.string().max(5).optional(),
              horario_fim: z.string().max(5).optional(),
              tipo: z.enum(["unico", "diario", "semanal"]).optional(),
            }),
            execute: async (a) => { proposals.push({ id: uid(), kind: "compromisso", data: a }); return { ok: true }; },
          }),
          propor_treino: tool({
            description: "Propõe (NÃO cria) um plano de treino.",
            inputSchema: z.object({
              nome: z.string().min(1).max(60),
              dias: z.array(z.object({
                dia: z.string().min(1).max(40),
                foco: z.string().max(80).optional(),
                exercicios: z.array(z.object({
                  nome: z.string().min(1).max(80),
                  series: z.number().int().min(1).max(20).optional(),
                  reps: z.string().max(20).optional(),
                })).max(20),
              })).max(7),
            }),
            execute: async (a) => { proposals.push({ id: uid(), kind: "treino", data: a }); return { ok: true }; },
          }),
          propor_dieta: tool({
            description: "Propõe (NÃO cria) um plano de dieta.",
            inputSchema: z.object({
              nome: z.string().max(60).optional(),
              hidratacao_ml: z.number().int().min(0).max(10000).optional(),
              refeicoes: z.array(z.object({
                horario: z.string().max(10).optional(),
                nome: z.string().min(1).max(60),
                itens: z.array(z.string().max(80)).max(20),
              })).max(10),
            }),
            execute: async (a) => { proposals.push({ id: uid(), kind: "dieta", data: a }); return { ok: true }; },
          }),
          registrar_anamnese: tool({
            description: "Salva fatos de anamnese que o usuário forneceu (objetivo, disponibilidade, lesões, sono, preferências alimentares, etc.) pra não perguntar de novo. NÃO use para treino/dieta/hábito/compromisso.",
            inputSchema: z.object({ campos: z.record(z.string(), z.any()) }),
            execute: async ({ campos }) => {
              if (!supabase || !userId) return { ok: true };
              try {
                const { data: cur } = await supabase.from("user_health_intake").select("data").eq("user_id", userId).maybeSingle();
                const merged = { ...((cur?.data ?? {}) as Record<string, unknown>), ...campos };
                if (cur) await supabase.from("user_health_intake").update({ data: merged }).eq("user_id", userId);
                else await supabase.from("user_health_intake").insert({ user_id: userId, data: merged });
                return { ok: true };
              } catch { return { ok: true }; }
            },
          }),
        } as const;

        const model = createChatModelWithFallback();
        const system = `${PERSONA}\n\n${contextBlock}`;
        const modelMessages = incoming
          .filter((m) => m.text?.trim())
          .map((m) => ({ role: m.role, content: m.text }));

        let text = "";
        try {
          const res = await generateText({
            model,
            system,
            messages: modelMessages,
            tools,
            stopWhen: stepCountIs(6),
          });
          text = res.text?.trim() ?? "";
        } catch {
          return Response.json({ text: "Tive um problema pra responder agora. Tenta de novo?", proposals: [] });
        }

        // Persiste histórico (produção).
        if (supabase && userId) {
          try {
            const lastUser = [...incoming].reverse().find((m) => m.role === "user");
            const rows: Array<{ user_id: string; role: string; content: string }> = [];
            if (lastUser?.text?.trim()) rows.push({ user_id: userId, role: "user", content: lastUser.text.trim() });
            if (text) rows.push({ user_id: userId, role: "assistant", content: text });
            if (rows.length) await supabase.from("assistant_messages").insert(rows);
          } catch { /* noop */ }
        }

        return Response.json({ text: text || "…", proposals });
      },
    },
  },
});
