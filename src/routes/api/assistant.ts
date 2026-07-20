import { createFileRoute } from "@tanstack/react-router";
import { streamText, tool, stepCountIs } from "ai";
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
import { assistantName } from "@/lib/assistant-name";
import { formatMomentBlock, readClientMoment } from "@/lib/client-moment.server";

type ImageAttachment = { base64: string; mediaType: string };
type InMsg = { role: "user" | "assistant"; text: string; images?: ImageAttachment[] };
type Body = { messages?: InMsg[]; conversation_id?: string };

type ChatSettings = {
  persona: string;
  response_length: string;
  focus: string;
  custom_instructions: string;
  assistant_name: string;
};
const DEFAULT_SETTINGS: ChatSettings = {
  persona: "caloroso",
  response_length: "equilibrado",
  focus: "geral",
  custom_instructions: "",
  assistant_name: "",
};

// Propostas que o agente monta (NÃO grava nada — o usuário confirma no app).
export type Proposal =
  | {
      id: string;
      kind: "habito";
      data: {
        titulo: string;
        frequencia: "diario" | "semanal" | "mensal";
        meta?: number;
        area?: string;
      };
    }
  | {
      id: string;
      kind: "compromisso";
      data: {
        titulo: string;
        dias_semana?: number[];
        horario_inicio?: string;
        horario_fim?: string;
        tipo?: "unico" | "diario" | "semanal";
      };
    }
  | {
      id: string;
      kind: "treino";
      data: {
        nome: string;
        dias: Array<{
          dia: string;
          foco?: string;
          exercicios: Array<{ nome: string; series?: number; reps?: string }>;
        }>;
      };
    }
  | {
      id: string;
      kind: "dieta";
      data: {
        nome?: string;
        hidratacao_ml?: number;
        refeicoes: Array<{ horario?: string; nome: string; itens: string[] }>;
      };
    };

const TOM: Record<string, string> = {
  caloroso: "um mentor caloroso, humano e acolhedor, mas direto",
  direto: "objetivo e prático, direto ao ponto, sem rodeios",
  tecnico: "técnico e preciso, citando fundamentos quando ajudar",
};
const TAMANHO: Record<string, string> = {
  curtas: "Respostas MUITO curtas: no máximo 3 linhas.",
  equilibrado: "Respostas curtas e humanas (até ~6 linhas).",
  detalhadas: "Pode se estender quando ajudar (até ~12 linhas), com passos claros.",
};
const FOCO: Record<string, string> = {
  geral: "",
  treino: "Quando fizer sentido, dê preferência a temas de treino/exercício.",
  nutricao: "Quando fizer sentido, dê preferência a temas de nutrição/alimentação.",
  mente: "Quando fizer sentido, dê preferência a temas de mente, sono e bem-estar.",
};

// Monta o system prompt a partir das preferências do usuário (config da IA).
function buildPersona(s: ChatSettings): string {
  const lines = [
    CRISIS_CLAUSE,
    "",
    `Seu nome é ${assistantName(s)}. Você é a inteligência digital do Weme — ${TOM[s.persona] ?? TOM.caloroso}, em português do Brasil.`,
    `Ao se apresentar, diga que é ${assistantName(s)}, uma inteligência digital. Nunca use outro nome.`,
    "Converse naturalmente, SEM roteiro fixo. Entenda o pedido e só aja quando o usuário pedir algo concreto.",
    "Se o usuário enviar uma IMAGEM, analise-a e responda sobre o que vê. Se for alimento, estime calorias; se for exercício/postura, dê feedback; em qualquer outro caso, descreva/comente.",
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
    `9. ${TAMANHO[s.response_length] ?? TAMANHO.equilibrado}`,
  ];
  if (FOCO[s.focus]) lines.push(`10. ${FOCO[s.focus]}`);
  const ci = s.custom_instructions?.trim();
  if (ci) lines.push("", "## Preferências do usuário (sempre respeitar)", ci.slice(0, 500));
  return lines.join("\n");
}

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
          supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            {
              global: { headers: { Authorization: `Bearer ${token}` } },
              auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
            },
          );
          const { data: claims, error } = await supabase.auth.getClaims(token);
          if (error || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });
          userId = claims.claims.sub as string;
        }

        const rlKey = userId ?? "dev:mock";
        const rl = checkRateLimit(rlKey);
        if (!rl.ok) return rateLimitResponse(rl.message);

        // Config da IA + contexto (o que já sabemos + progresso real do usuário).
        const todayStr = new Date().toISOString().slice(0, 10);
        const weekAgoStr = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
        let settings: ChatSettings = DEFAULT_SETTINGS;
        let contextBlock = `${DATA_HEADER}\n(ambiente de desenvolvimento — sem dados prévios)`;
        if (supabase && userId) {
          try {
            const [
              { data: profile },
              { data: intake },
              { data: habits },
              { data: missions },
              { data: plans },
              { data: area },
              { data: cfg },
              { data: foodToday },
              { data: workouts },
            ] = await Promise.all([
              supabase
                .from("profiles")
                .select(
                  "display_name,goal,age,weight_kg,height_cm,gender,days_per_week,time_per_day_min,behavioral_class,streak,xp",
                )
                .eq("id", userId)
                .maybeSingle(),
              supabase
                .from("user_health_intake")
                .select("data")
                .eq("user_id", userId)
                .maybeSingle(),
              supabase
                .from("habits")
                .select("title")
                .eq("user_id", userId)
                .eq("active", true)
                .limit(20),
              supabase
                .from("user_missions")
                .select("title")
                .eq("user_id", userId)
                .eq("active", true)
                .limit(20),
              supabase.from("workout_plans").select("name").eq("user_id", userId).limit(10),
              supabase
                .from("area_progress")
                .select("meta")
                .eq("user_id", userId)
                .eq("area_slug", "cozinha")
                .maybeSingle(),
              supabase
                .from("chat_settings")
                .select("persona,response_length,focus,custom_instructions,assistant_name")
                .eq("user_id", userId)
                .maybeSingle(),
              supabase
                .from("food_log_entries")
                .select("kcal")
                .eq("user_id", userId)
                .eq("log_date", todayStr),
              supabase
                .from("workout_sessions")
                .select("id")
                .eq("user_id", userId)
                .gte("session_date", weekAgoStr),
            ]);
            if (cfg) settings = { ...DEFAULT_SETTINGS, ...(cfg as Partial<ChatSettings>) };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dietPlan = ((area?.meta ?? {}) as any).diet_plan;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const kcalToday = ((foodToday ?? []) as any[]).reduce((s, e) => s + (e.kcal || 0), 0);
            const kcalTarget = dietPlan?.daily_kcal_target ?? null;
            const workoutsWeek = ((workouts ?? []) as unknown[]).length;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = (profile ?? {}) as any;
            contextBlock = [
              DATA_HEADER,
              "(NÃO pergunte de novo o que já estiver aqui; USE esses dados de progresso pra personalizar as respostas)",
              `Perfil: ${JSON.stringify(profile ?? {})}`,
              `Progresso: streak ${p.streak ?? 0} dias, XP ${p.xp ?? 0}.`,
              `Calorias hoje: ${kcalToday} kcal${kcalTarget ? ` (meta ${kcalTarget})` : ""}.`,
              `Treinos nos últimos 7 dias: ${workoutsWeek}.`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              `Anamnese salva: ${JSON.stringify((intake as any)?.data ?? {})}`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              `Hábitos ativos: ${((habits ?? []) as any[]).map((h) => h.title).join(", ") || "nenhum"}`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              `Compromissos: ${((missions ?? []) as any[]).map((m) => m.title).join(", ") || "nenhum"}`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              `Planos de treino: ${((plans ?? []) as any[]).map((pl) => pl.name).join(", ") || "nenhum"}`,
              `Dieta salva: ${dietPlan ? "sim" : "não"}`,
            ].join("\n");
          } catch {
            contextBlock = `${DATA_HEADER}\n(não consegui carregar os dados prévios)`;
          }
        }

        // Conversa: usa a informada ou cria uma nova. O título aqui é provisório —
        // a tool `nomear_conversa` o substitui por um nome descritivo dentro da
        // MESMA chamada de IA (uma chamada separada só pro título gastaria
        // crédito Run por conversa).
        let conversationId: string | null = body.conversation_id ?? null;
        let conversationTitle: string | null = null;
        if (supabase && userId && !conversationId) {
          const firstUser = incoming.find((m) => m.role === "user");
          conversationTitle = (firstUser?.text?.trim() || "Nova conversa").slice(0, 40);
          try {
            const { data: conv } = await supabase
              .from("chat_conversations")
              .insert({ user_id: userId, title: conversationTitle })
              .select("id")
              .single();
            conversationId = conv?.id ?? null;
          } catch {
            conversationId = null;
          }
        }

        const proposals: Proposal[] = [];
        const uid = () => globalThis.crypto.randomUUID();

        const tools = {
          nomear_conversa: tool({
            description:
              "Dá um nome curto e descritivo a ESTA conversa. Chame UMA vez, logo na primeira " +
              "resposta, assim que entender o assunto. Ex.: 'Treino de força 3x na semana', " +
              "'Ajuste de dieta pra cutting'. Não use a mensagem crua do usuário nem aspas.",
            inputSchema: z.object({ titulo: z.string().min(3).max(60) }),
            execute: async ({ titulo }) => {
              const limpo = titulo.trim().slice(0, 60);
              if (!supabase || !userId || !conversationId || !limpo) return { ok: false };
              // Rename manual do usuário nunca é sobrescrito: só renomeia
              // enquanto o título ainda for o provisório.
              const { error } = await supabase
                .from("chat_conversations")
                .update({ title: limpo })
                .eq("id", conversationId)
                .eq("user_id", userId)
                .eq("title", conversationTitle ?? "");
              if (error) return { ok: false };
              conversationTitle = limpo;
              return { ok: true };
            },
          }),
          propor_habito: tool({
            description: "Propõe (NÃO cria) um hábito. Chame só quando tiver título e frequência.",
            inputSchema: z.object({
              titulo: z.string().min(1).max(60),
              frequencia: z.enum(["diario", "semanal", "mensal"]),
              meta: z.number().int().min(1).max(30).optional(),
              area: z.string().max(30).optional(),
            }),
            execute: async (a) => {
              proposals.push({ id: uid(), kind: "habito", data: a });
              return { ok: true };
            },
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
            execute: async (a) => {
              proposals.push({ id: uid(), kind: "compromisso", data: a });
              return { ok: true };
            },
          }),
          propor_treino: tool({
            description: "Propõe (NÃO cria) um plano de treino.",
            inputSchema: z.object({
              nome: z.string().min(1).max(60),
              dias: z
                .array(
                  z.object({
                    dia: z.string().min(1).max(40),
                    foco: z.string().max(80).optional(),
                    exercicios: z
                      .array(
                        z.object({
                          nome: z.string().min(1).max(80),
                          series: z.number().int().min(1).max(20).optional(),
                          reps: z.string().max(20).optional(),
                        }),
                      )
                      .max(20),
                  }),
                )
                .max(7),
            }),
            execute: async (a) => {
              proposals.push({ id: uid(), kind: "treino", data: a });
              return { ok: true };
            },
          }),
          propor_dieta: tool({
            description: "Propõe (NÃO cria) um plano de dieta.",
            inputSchema: z.object({
              nome: z.string().max(60).optional(),
              hidratacao_ml: z.number().int().min(0).max(10000).optional(),
              refeicoes: z
                .array(
                  z.object({
                    horario: z.string().max(10).optional(),
                    nome: z.string().min(1).max(60),
                    itens: z.array(z.string().max(80)).max(20),
                  }),
                )
                .max(10),
            }),
            execute: async (a) => {
              proposals.push({ id: uid(), kind: "dieta", data: a });
              return { ok: true };
            },
          }),
          registrar_anamnese: tool({
            description:
              "Salva fatos de anamnese que o usuário forneceu (objetivo, disponibilidade, lesões, sono, preferências alimentares, etc.) pra não perguntar de novo. NÃO use para treino/dieta/hábito/compromisso.",
            inputSchema: z.object({ campos: z.record(z.string(), z.any()) }),
            execute: async ({ campos }) => {
              if (!supabase || !userId) return { ok: true };
              try {
                const { data: cur } = await supabase
                  .from("user_health_intake")
                  .select("data")
                  .eq("user_id", userId)
                  .maybeSingle();
                const merged = { ...((cur?.data ?? {}) as Record<string, unknown>), ...campos };
                if (cur)
                  await supabase
                    .from("user_health_intake")
                    .update({ data: merged })
                    .eq("user_id", userId);
                else
                  await supabase
                    .from("user_health_intake")
                    .insert({ user_id: userId, data: merged });
                return { ok: true };
              } catch {
                return { ok: true };
              }
            },
          }),
        } as const;

        const model = createChatModelWithFallback();
        const system = `${buildPersona(settings)}\n\n${contextBlock}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const modelMessages: any[] = incoming
          .filter((m) => m.text?.trim() || (m.role === "user" && m.images?.length))
          .map((m) => {
            if (m.role === "user" && m.images?.length) {
              return {
                role: "user" as const,
                content: [
                  ...m.images.map((img) => ({
                    type: "image" as const,
                    image: img.base64,
                    mediaType: img.mediaType,
                  })),
                  ...(m.text?.trim()
                    ? [{ type: "text" as const, text: truncateUserText(m.text) }]
                    : []),
                ],
              };
            }
            return {
              role: m.role,
              content: m.role === "user" ? truncateUserText(m.text) : m.text,
            };
          });

        // Streaming (SSE): texto em deltas + propostas ao final. As propostas
        // são geradas pelos execute() das tools enquanto o stream é consumido.
        const result = streamText({
          model,
          system,
          messages: modelMessages,
          tools,
          stopWhen: stepCountIs(6),
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        });

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (obj: unknown) =>
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

            // Informa o id da conversa (nova ou existente) pra o cliente.
            if (conversationId)
              send({ type: "conversation", id: conversationId, title: conversationTitle });

            let full = "";
            try {
              for await (const delta of result.textStream) {
                full += delta;
                send({ type: "text", delta });
              }
            } catch (err) {
              console.error("[api/assistant] streamText falhou:", err);
              send({ type: "error" });
              controller.close();
              return;
            }

            // Propostas coletadas pelos tools durante o stream.
            send({ type: "proposals", proposals });

            // Persiste histórico (produção).
            if (supabase && userId) {
              try {
                const lastUser = [...incoming].reverse().find((m) => m.role === "user");
                const rows: Array<{
                  user_id: string;
                  role: string;
                  content: string;
                  conversation_id: string | null;
                }> = [];
                if (lastUser?.text?.trim())
                  rows.push({
                    user_id: userId,
                    role: "user",
                    content: lastUser.text.trim(),
                    conversation_id: conversationId,
                  });
                if (full.trim())
                  rows.push({
                    user_id: userId,
                    role: "assistant",
                    content: full.trim(),
                    conversation_id: conversationId,
                  });
                if (rows.length) await supabase.from("assistant_messages").insert(rows);
                if (conversationId)
                  await supabase
                    .from("chat_conversations")
                    .update({ updated_at: new Date().toISOString() })
                    .eq("id", conversationId);
              } catch {
                /* noop */
              }
            }

            send({ type: "done" });
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
