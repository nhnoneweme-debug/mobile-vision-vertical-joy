import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createChatModelWithFallback } from "@/lib/ai-gateway.server";

export type Exercise = {
  name: string;
  sets: number;
  reps: string; // "10" or "8-12" or "30s"
  rest_s?: number | null;
  notes?: string;
};

export type Session = {
  day: string; // "Segunda", "A", "Push"...
  focus: string; // "Peito + tríceps"
  exercises: Exercise[];
};

export type TrainingPlan = {
  updated_at: string;
  source_text: string;
  split: string; // "ABC", "Push/Pull/Legs", "Full Body 3x"
  days_per_week: number;
  sessions: Session[];
  warnings?: string[];
};

const ExerciseSchema = z.object({
  name: z.string().min(1).max(80),
  sets: z.number().int().min(1).max(20),
  reps: z.string().min(1).max(20),
  rest_s: z.number().int().min(0).max(600).nullable().optional(),
  notes: z.string().max(200).optional(),
});

const SessionSchema = z.object({
  day: z.string().min(1).max(40),
  focus: z.string().min(1).max(80),
  exercises: z.array(ExerciseSchema).max(20),
});

const TrainingJsonSchema = z.object({
  split: z.string().max(40),
  days_per_week: z.number().int().min(1).max(7),
  sessions: z.array(SessionSchema).max(7),
  warnings: z.array(z.string().max(200)).max(6).optional(),
});

export const parseTrainingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ raw_text: z.string().min(5).max(6000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!process.env.OPENAI_API_KEY && !LOVABLE_API_KEY) throw new Error("Missing AI key");

    const model = createChatModelWithFallback(LOVABLE_API_KEY);

    const sys = [
      "Você é coach de treino. Receba uma planilha/descrição de treino em texto livre (português) e devolva APENAS JSON válido.",
      "Formato exato:",
      '{ "split":"ABC|PPL|Full Body|...", "days_per_week":4, "sessions":[{"day":"A","focus":"Peito + tríceps","exercises":[{"name":"Supino reto","sets":4,"reps":"8-12","rest_s":90,"notes":"opcional"}]}], "warnings":["..."] }',
      "Regras: detecte split a partir do texto; rest_s em segundos; reps pode ser '10', '8-12' ou '30s'.",
      "Sem prosa, sem markdown, apenas o JSON.",
    ].join("\n");

    const res = await generateText({
      model,
      system: sys,
      messages: [{ role: "user", content: data.raw_text }],
    });

    let parsed: z.infer<typeof TrainingJsonSchema>;
    try {
      const cleaned = res.text.trim().replace(/^```json\s*|\s*```$/g, "");
      parsed = TrainingJsonSchema.parse(JSON.parse(cleaned));
    } catch {
      throw new Error("A IA não devolveu JSON válido. Tente reescrever o treino com mais detalhes.");
    }

    const plan: TrainingPlan = {
      updated_at: new Date().toISOString(),
      source_text: data.raw_text,
      split: parsed.split,
      days_per_week: parsed.days_per_week,
      sessions: parsed.sessions,
      warnings: parsed.warnings ?? [],
    };

    const { data: existing } = await context.supabase
      .from("area_progress")
      .select("id, meta")
      .eq("user_id", context.userId)
      .eq("area_slug", "treino")
      .maybeSingle();
    const meta = {
      ...((existing?.meta ?? {}) as Record<string, unknown>),
      training_plan: plan,
    };
    if (existing) {
      const { error } = await context.supabase
        .from("area_progress")
        .update({ meta: meta as never })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("area_progress")
        .insert({ user_id: context.userId, area_slug: "treino", level: 1, xp: 0, meta: meta as never });
      if (error) throw new Error(error.message);
    }

    return plan;
  });

export const getTrainingPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("area_progress")
      .select("meta")
      .eq("user_id", context.userId)
      .eq("area_slug", "treino")
      .maybeSingle();
    const meta = (data?.meta ?? {}) as Record<string, unknown>;
    return (meta.training_plan as TrainingPlan | undefined) ?? null;
  });

export const clearTrainingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: existing } = await context.supabase
      .from("area_progress")
      .select("id, meta")
      .eq("user_id", context.userId)
      .eq("area_slug", "treino")
      .maybeSingle();
    if (!existing) return { ok: true };
    const meta = { ...((existing.meta ?? {}) as Record<string, unknown>) };
    delete meta.training_plan;
    await context.supabase
      .from("area_progress")
      .update({ meta: meta as never })
      .eq("id", existing.id);
    return { ok: true };
  });
