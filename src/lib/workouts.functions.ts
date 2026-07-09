import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Tipos do módulo de treino. `days` é jsonb no banco.
export type WorkoutExercise = {
  id: string;
  nome: string;
  series?: number;
  reps?: string;
  nota?: string;
};
export type WorkoutDay = {
  id: string;
  dia: string;
  foco?: string;
  nota?: string;
  exercicios: WorkoutExercise[];
};
export type WorkoutPlan = {
  id: string;
  name: string;
  days: WorkoutDay[];
  source: string;
  created_at: string;
  updated_at: string;
};
export type WorkoutSession = {
  id: string;
  plan_id: string | null;
  session_date: string;
  duration_sec: number;
  exercises_done: number;
  exercises_total: number;
  created_at: string;
};
export type WorkoutProgressRow = {
  day_key: string;
  exercise_key: string;
  done: boolean;
  series: number;
  weights: number[];
};

// NOTA: as tabelas workout_* ainda não estão no types.ts gerado (regenera após a
// migration rodar no Lovable). Por isso usamos um handle "solto" do supabase aqui.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const ExerciseSchema = z.object({
  id: z.string().min(1).max(64),
  nome: z.string().min(1).max(80),
  series: z.number().int().min(0).max(50).optional(),
  reps: z.string().max(20).optional(),
  nota: z.string().max(200).optional(),
});
const DaySchema = z.object({
  id: z.string().min(1).max(64),
  dia: z.string().min(1).max(40),
  foco: z.string().max(80).optional(),
  nota: z.string().max(200).optional(),
  exercicios: z.array(ExerciseSchema).max(30),
});
const DaysSchema = z.array(DaySchema).max(14);

const today = () => new Date().toISOString().slice(0, 10);

export const listWorkoutPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkoutPlan[]> => {
    const db = context.supabase as Db;
    const { data, error } = await db
      .from("workout_plans")
      .select("id, name, days, source, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as WorkoutPlan[];
  });

export const createWorkoutPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(60),
        days: DaysSchema.optional(),
        source: z.enum(["manual", "ai"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<WorkoutPlan> => {
    const db = context.supabase as Db;
    const { data: row, error } = await db
      .from("workout_plans")
      .insert({
        user_id: context.userId,
        name: data.name.trim(),
        days: data.days ?? [],
        source: data.source ?? "manual",
      })
      .select("id, name, days, source, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as WorkoutPlan;
  });

export const updateWorkoutPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(60).optional(),
        days: DaysSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<WorkoutPlan> => {
    const db = context.supabase as Db;
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.days !== undefined) patch.days = data.days;
    const { data: row, error } = await db
      .from("workout_plans")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id, name, days, source, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as WorkoutPlan;
  });

export const deleteWorkoutPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = context.supabase as Db;
    const { error } = await db
      .from("workout_plans")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWorkoutSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ planId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<WorkoutSession[]> => {
    const db = context.supabase as Db;
    let q = db
      .from("workout_sessions")
      .select("id, plan_id, session_date, duration_sec, exercises_done, exercises_total, created_at")
      .eq("user_id", context.userId);
    if (data.planId) q = q.eq("plan_id", data.planId);
    const { data: rows, error } = await q
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []) as WorkoutSession[];
  });

export const createWorkoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid().nullable().optional(),
        durationSec: z.number().int().min(0).max(86400),
        exercisesDone: z.number().int().min(0).max(500),
        exercisesTotal: z.number().int().min(0).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<WorkoutSession> => {
    const db = context.supabase as Db;
    const { data: row, error } = await db
      .from("workout_sessions")
      .insert({
        user_id: context.userId,
        plan_id: data.planId ?? null,
        duration_sec: data.durationSec,
        exercises_done: data.exercisesDone,
        exercises_total: data.exercisesTotal,
      })
      .select("id, plan_id, session_date, duration_sec, exercises_done, exercises_total, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as WorkoutSession;
  });

export const getTodayProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ planId: z.string().uuid(), dayKey: z.string().min(1).max(64) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<WorkoutProgressRow[]> => {
    const db = context.supabase as Db;
    const { data: rows, error } = await db
      .from("workout_progress")
      .select("day_key, exercise_key, done, series, weights")
      .eq("user_id", context.userId)
      .eq("plan_id", data.planId)
      .eq("day_key", data.dayKey)
      .eq("progress_date", today());
    if (error) throw new Error(error.message);
    return (rows ?? []) as WorkoutProgressRow[];
  });

// Registra +1 série feita (com o peso da série), respeitando o limite `target`.
// Marca `done` quando atinge o limite. Retorna o estado atualizado.
export const logSerie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        dayKey: z.string().min(1).max(64),
        exerciseKey: z.string().min(1).max(64),
        target: z.number().int().min(1).max(50),
        weight: z.number().min(0).max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ series: number; done: boolean; weights: number[] }> => {
    const db = context.supabase as Db;
    const { data: cur } = await db
      .from("workout_progress")
      .select("series, weights")
      .eq("user_id", context.userId)
      .eq("plan_id", data.planId)
      .eq("day_key", data.dayKey)
      .eq("exercise_key", data.exerciseKey)
      .eq("progress_date", today())
      .maybeSingle();
    const prevSeries = Number(cur?.series ?? 0);
    const prevWeights: number[] = Array.isArray(cur?.weights) ? cur.weights : [];
    if (prevSeries >= data.target) {
      return { series: prevSeries, done: true, weights: prevWeights };
    }
    const series = prevSeries + 1;
    const weights = [...prevWeights, data.weight ?? 0];
    const done = series >= data.target;
    const { error } = await db.from("workout_progress").upsert(
      {
        user_id: context.userId,
        plan_id: data.planId,
        day_key: data.dayKey,
        exercise_key: data.exerciseKey,
        series,
        weights,
        done,
        progress_date: today(),
      },
      { onConflict: "user_id,plan_id,day_key,exercise_key" },
    );
    if (error) throw new Error(error.message);
    return { series, done, weights };
  });

// Desfaz a última série feita (remove o peso). done volta a false.
export const undoSerie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ planId: z.string().uuid(), dayKey: z.string().min(1).max(64), exerciseKey: z.string().min(1).max(64) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ series: number; done: boolean; weights: number[] }> => {
    const db = context.supabase as Db;
    const { data: cur } = await db
      .from("workout_progress")
      .select("series, weights")
      .eq("user_id", context.userId)
      .eq("plan_id", data.planId)
      .eq("day_key", data.dayKey)
      .eq("exercise_key", data.exerciseKey)
      .eq("progress_date", today())
      .maybeSingle();
    const prevSeries = Number(cur?.series ?? 0);
    const prevWeights: number[] = Array.isArray(cur?.weights) ? cur.weights : [];
    const series = Math.max(0, prevSeries - 1);
    const weights = prevWeights.slice(0, series);
    const { error } = await db.from("workout_progress").upsert(
      {
        user_id: context.userId,
        plan_id: data.planId,
        day_key: data.dayKey,
        exercise_key: data.exerciseKey,
        series,
        weights,
        done: false,
        progress_date: today(),
      },
      { onConflict: "user_id,plan_id,day_key,exercise_key" },
    );
    if (error) throw new Error(error.message);
    return { series, done: false, weights };
  });

export const setProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        dayKey: z.string().min(1).max(64),
        exerciseKey: z.string().min(1).max(64),
        done: z.boolean(),
        series: z.number().int().min(0).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = context.supabase as Db;
    const { error } = await db.from("workout_progress").upsert(
      {
        user_id: context.userId,
        plan_id: data.planId,
        day_key: data.dayKey,
        exercise_key: data.exerciseKey,
        done: data.done,
        series: data.series,
        progress_date: today(),
      },
      { onConflict: "user_id,plan_id,day_key,exercise_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
