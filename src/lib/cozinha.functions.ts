import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

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
  .inputValidator((d: unknown) =>
    z.object({ raw_text: z.string().min(5).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
    const model = gateway("google/gemini-3-flash-preview");

    const sys = [
      "Você é nutricionista assistente. Receba uma dieta em texto livre (português, pode estar bagunçada) e devolva APENAS JSON válido.",
      "Formato exato:",
      '{ "meals":[{"time":"HH:MM","name":"...","items":["..."],"notes":"opcional"}], "hydration_ml": 2500, "warnings":["..."] }',
      "Regras: ordene meals por horário; use HH:MM 24h; se faltar horário, distribua entre 07:00–22:00; items curtos.",
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
    await context.supabase.from("area_progress").update({ meta: meta as never }).eq("id", existing.id);
    return { ok: true };
  });
