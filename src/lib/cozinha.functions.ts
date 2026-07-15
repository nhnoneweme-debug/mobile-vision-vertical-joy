import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createChatModelWithFallback } from "@/lib/ai-gateway.server";

export type Meal = {
  time: string; // "HH:MM"
  name: string;
  items: string[];
  notes?: string;
};

export type DietPlan = {
  updated_at: string;
  source_text: string;
  meals: Meal[];
  hydration_ml?: number | null;
  daily_kcal_target?: number | null;
  warnings?: string[];
};

const MealSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().min(1).max(60),
  items: z.array(z.string().min(1).max(120)).max(20),
  notes: z.string().max(200).optional(),
});

const DietJsonSchema = z.object({
  meals: z.array(MealSchema).max(12),
  hydration_ml: z.number().int().min(0).max(8000).nullable().optional(),
  daily_kcal_target: z.number().int().min(500).max(6000).nullable().optional(),
  warnings: z.array(z.string().max(200)).max(6).optional(),
});


async function saveDietToArea(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  plan: DietPlan,
) {
  const { data: existing } = await supabase
    .from("area_progress")
    .select("id, meta")
    .eq("user_id", userId)
    .eq("area_slug", "cozinha")
    .maybeSingle();
  const meta = { ...((existing?.meta ?? {}) as Record<string, unknown>), diet_plan: plan };
  if (existing) {
    const { error } = await supabase.from("area_progress").update({ meta }).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("area_progress")
      .insert({ user_id: userId, area_slug: "cozinha", level: 1, xp: 0, meta });
    if (error) throw new Error(error.message);
  }
}

export const parseDietPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ raw_text: z.string().min(5).max(4000) }).parse(d))
  .handler(async ({ data, context }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!process.env.OPENAI_API_KEY && !LOVABLE_API_KEY) throw new Error("Missing AI key");

    const model = createChatModelWithFallback(LOVABLE_API_KEY);

    const sys = [
      "Você é nutricionista assistente. Receba uma dieta em texto livre (português, pode estar bagunçada) e devolva APENAS JSON válido.",
      "Formato exato:",
      '{ "meals":[{"time":"HH:MM","name":"...","items":["..."],"notes":"opcional"}], "hydration_ml": 2500, "daily_kcal_target": 2000, "warnings":["..."] }',
      "Regras: ordene meals por horário; use HH:MM 24h; se faltar horário, distribua entre 07:00–22:00; items curtos.",
      "daily_kcal_target: estime o total calórico diário aproximado somando as refeições descritas.",
      "Sem prosa, sem markdown, apenas o JSON.",
    ].join("\n");


    const res = await generateText({
      model,
      system: sys,
      messages: [{ role: "user", content: data.raw_text }],
    });

    let parsed: z.infer<typeof DietJsonSchema>;
    try {
      const cleaned = res.text.trim().replace(/^```json\s*|\s*```$/g, "");
      parsed = DietJsonSchema.parse(JSON.parse(cleaned));
    } catch (e) {
      throw new Error("A IA não devolveu JSON válido. Tente reescrever a dieta com mais detalhes.");
    }

    parsed.meals.sort((a, b) => a.time.localeCompare(b.time));

    const plan: DietPlan = {
      updated_at: new Date().toISOString(),
      source_text: data.raw_text,
      meals: parsed.meals,
      hydration_ml: parsed.hydration_ml ?? null,
      daily_kcal_target: parsed.daily_kcal_target ?? null,
      warnings: parsed.warnings ?? [],
    };


    await saveDietToArea(context.supabase, context.userId, plan);
    return plan;
  });

// Gera uma dieta do zero com a IA, a partir do perfil/objetivo do onboarding
// (sem precisar o usuário colar texto). Mesmo formato/validação do parseDietPlan.
export const generateDietFromProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!process.env.OPENAI_API_KEY && !LOVABLE_API_KEY) throw new Error("Missing AI key");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_name,goal,age,weight_kg,height_cm,gender,days_per_week,time_per_day_min")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile?.goal) {
      throw new Error("Complete seu objetivo no onboarding antes de gerar a dieta com a IA.");
    }

    const model = createChatModelWithFallback(LOVABLE_API_KEY);
    const sys = [
      "Você é nutricionista assistente. Monte um plano alimentar de UM dia (a rotina se repete diariamente),",
      "adequado ao perfil informado, e devolva APENAS JSON válido.",
      "Formato exato:",
      '{ "meals":[{"time":"HH:MM","name":"...","items":["..."],"notes":"opcional"}], "hydration_ml": 2500, "daily_kcal_target": 2000, "warnings":["..."] }',
      "Regras: 4 a 6 refeições, ordenadas por horário HH:MM 24h entre 06:00–22:00; items curtos e realistas.",
      "daily_kcal_target: estime a meta calórica diária adequada ao objetivo/perfil informado.",
      "Sem prosa, sem markdown, apenas o JSON.",
    ].join("\n");

    const userPrompt = [
      `Nome: ${profile.display_name ?? "—"}`,
      `Objetivo: ${profile.goal}`,
      profile.age ? `Idade: ${profile.age}` : "",
      profile.gender ? `Gênero: ${profile.gender}` : "",
      profile.weight_kg ? `Peso: ${profile.weight_kg}kg` : "",
      profile.height_cm ? `Altura: ${profile.height_cm}cm` : "",
      profile.days_per_week ? `Dias de treino/semana: ${profile.days_per_week}` : "",
      profile.time_per_day_min ? `Tempo disponível/dia: ${profile.time_per_day_min}min` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await generateText({
      model,
      system: sys,
      messages: [{ role: "user", content: userPrompt }],
    });

    let parsed: z.infer<typeof DietJsonSchema>;
    try {
      const cleaned = res.text.trim().replace(/^```json\s*|\s*```$/g, "");
      parsed = DietJsonSchema.parse(JSON.parse(cleaned));
    } catch (e) {
      throw new Error("A IA não devolveu um plano válido. Tente novamente.");
    }
    parsed.meals.sort((a, b) => a.time.localeCompare(b.time));

    const plan: DietPlan = {
      updated_at: new Date().toISOString(),
      source_text: `Gerado pela IA a partir do perfil (objetivo: ${profile.goal})`,
      meals: parsed.meals,
      hydration_ml: parsed.hydration_ml ?? null,
      daily_kcal_target: parsed.daily_kcal_target ?? null,
      warnings: parsed.warnings ?? [],
    };

    await saveDietToArea(context.supabase, context.userId, plan);
    return plan;
  });

export const getDietPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("area_progress")
      .select("meta")
      .eq("user_id", context.userId)
      .eq("area_slug", "cozinha")
      .maybeSingle();
    const meta = (data?.meta ?? {}) as Record<string, unknown>;
    return (meta.diet_plan as DietPlan | undefined) ?? null;
  });

// Salva uma dieta ESTRUTURADA (vinda de uma proposta confirmada pelo usuário).
// Retorna o plano anterior para permitir "desfazer".
export const saveDietPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().max(60).optional(),
        hydration_ml: z.number().int().min(0).max(10000).nullable().optional(),
        meals: z
          .array(
            z.object({
              time: z.string().max(10).optional(),
              name: z.string().min(1).max(60),
              items: z.array(z.string().min(1).max(120)).max(20),
            }),
          )
          .max(12),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ previous: DietPlan | null }> => {
    const { data: existing } = await context.supabase
      .from("area_progress")
      .select("meta")
      .eq("user_id", context.userId)
      .eq("area_slug", "cozinha")
      .maybeSingle();
    const previous =
      (((existing?.meta ?? {}) as Record<string, unknown>).diet_plan as DietPlan | undefined) ??
      null;
    const plan: DietPlan = {
      updated_at: new Date().toISOString(),
      source_text: data.name ?? "Montado pela IA",
      meals: data.meals.map((m) => ({ time: m.time ?? "12:00", name: m.name, items: m.items })),
      hydration_ml: data.hydration_ml ?? null,
      warnings: [],
    };
    await saveDietToArea(context.supabase, context.userId, plan);
    return { previous };
  });

// Restaura um plano de dieta anterior (para "desfazer"). plan=null limpa.
export const restoreDietPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ plan: z.any().nullable() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (data.plan) {
      await saveDietToArea(context.supabase, context.userId, data.plan as DietPlan);
    } else {
      const { data: existing } = await context.supabase
        .from("area_progress")
        .select("id, meta")
        .eq("user_id", context.userId)
        .eq("area_slug", "cozinha")
        .maybeSingle();
      if (existing) {
        const meta = { ...((existing.meta ?? {}) as Record<string, unknown>) };
        delete meta.diet_plan;
        await context.supabase
          .from("area_progress")
          .update({ meta: meta as never })
          .eq("id", existing.id);
      }
    }
    return { ok: true };
  });

export const clearDietPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: existing } = await context.supabase
      .from("area_progress")
      .select("id, meta")
      .eq("user_id", context.userId)
      .eq("area_slug", "cozinha")
      .maybeSingle();
    if (!existing) return { ok: true };
    const meta = { ...((existing.meta ?? {}) as Record<string, unknown>) };
    delete meta.diet_plan;
    await context.supabase
      .from("area_progress")
      .update({ meta: meta as never })
      .eq("id", existing.id);
    return { ok: true };
  });
