import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AlarmInput = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(60).default("Despertar"),
  time_local: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  days_of_week: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
  enabled: z.boolean().default(true),
  wake_style: z.enum(["gentle", "firm", "energetic", "custom"]).default("gentle"),
  max_snoozes: z.number().int().min(0).max(10).default(3),
  snooze_strategy: z.enum(["fixed", "adaptive"]).default("adaptive"),
});

export const listAlarms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("wake_alarms")
      .select("*")
      .eq("user_id", context.userId)
      .order("time_local");
    if (error) throw new Error(error.message);
    return data;
  });

export const upsertAlarm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AlarmInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = { ...data, user_id: context.userId };
    const { data: row, error } = data.id
      ? await context.supabase.from("wake_alarms").update(payload).eq("id", data.id).eq("user_id", context.userId).select().single()
      : await context.supabase.from("wake_alarms").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAlarm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("wake_alarms").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const startWakeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ alarm_id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("wake_sessions")
      .insert({ user_id: context.userId, alarm_id: data.alarm_id ?? null, status: "ringing" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("wake_events").insert({
      session_id: row.id,
      user_id: context.userId,
      kind: "ring",
      payload: {},
    });
    return row;
  });

export const getActiveSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("wake_sessions")
      .select("*")
      .eq("user_id", context.userId)
      .in("status", ["ringing", "snoozing"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });

export const recordSnooze = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ session_id: z.string().uuid(), minutes: z.number().int().min(1).max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: session } = await context.supabase
      .from("wake_sessions")
      .select("snooze_count,total_snooze_min")
      .eq("id", data.session_id)
      .eq("user_id", context.userId)
      .single();
    const next = {
      status: "snoozing" as const,
      snooze_count: (session?.snooze_count ?? 0) + 1,
      total_snooze_min: (session?.total_snooze_min ?? 0) + data.minutes,
    };
    const { error } = await context.supabase
      .from("wake_sessions")
      .update(next)
      .eq("id", data.session_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await context.supabase.from("wake_events").insert({
      session_id: data.session_id,
      user_id: context.userId,
      kind: "snooze",
      payload: { minutes: data.minutes },
    });
    return next;
  });

export const markAwake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ session_id: z.string().uuid(), mood: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("wake_sessions")
      .update({ status: "awake", woke_at: new Date().toISOString(), mood_on_wake: data.mood ?? null })
      .eq("id", data.session_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await context.supabase.from("wake_events").insert({
      session_id: data.session_id,
      user_id: context.userId,
      kind: "wake",
      payload: { mood: data.mood ?? null },
    });
    // cria bloco "wake" do dia
    await context.supabase.from("day_blocks").insert({
      user_id: context.userId,
      kind: "wake",
      started_at: new Date().toISOString(),
      completed: true,
    });
    return { ok: true };
  });

export const logDream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        session_id: z.string().uuid().optional(),
        raw_text: z.string().min(1),
        mood: z.string().optional(),
        lucidity: z.number().int().min(0).max(10).optional(),
        symbols: z.array(z.string()).optional(),
        themes: z.array(z.string()).optional(),
        ai_summary: z.string().optional(),
        ai_interpretation: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("dream_logs")
      .insert({
        user_id: context.userId,
        session_id: data.session_id ?? null,
        raw_text: data.raw_text,
        mood: data.mood ?? null,
        lucidity: data.lucidity ?? null,
        symbols: data.symbols ?? [],
        themes: data.themes ?? [],
        ai_summary: data.ai_summary ?? null,
        ai_interpretation: data.ai_interpretation ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (data.session_id) {
      await context.supabase
        .from("wake_sessions")
        .update({ dream_logged: true })
        .eq("id", data.session_id)
        .eq("user_id", context.userId);
    }
    return row;
  });

export const listDreams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("dream_logs")
      .select("*")
      .eq("user_id", context.userId)
      .order("logged_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data;
  });

export const listDayBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ date: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const date = data.date ?? new Date().toISOString().slice(0, 10);
    const { data: rows, error } = await context.supabase
      .from("day_blocks")
      .select("*")
      .eq("user_id", context.userId)
      .eq("date", date)
      .order("started_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows;
  });

export const createDayBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["wake", "dream", "kitchen", "move", "deep_work", "family", "wind_down", "sleep"]),
        notes: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("day_blocks")
      .insert({
        user_id: context.userId,
        kind: data.kind,
        started_at: new Date().toISOString(),
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const completeDayBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("day_blocks")
      .update({ completed: true, ended_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertSleepLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        date: z.string().optional(),
        bed_at: z.string().optional(),
        sleep_at: z.string().optional(),
        wake_at: z.string().optional(),
        quality: z.number().int().min(1).max(5).optional(),
        ritual_done: z.boolean().optional(),
        notes: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const date = data.date ?? new Date().toISOString().slice(0, 10);
    const { data: row, error } = await context.supabase
      .from("sleep_logs")
      .upsert(
        {
          user_id: context.userId,
          date,
          bed_at: data.bed_at ?? null,
          sleep_at: data.sleep_at ?? null,
          wake_at: data.wake_at ?? null,
          quality: data.quality ?? null,
          ritual_done: data.ritual_done ?? false,
          notes: data.notes ?? null,
        },
        { onConflict: "user_id,date" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listSleepLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sleep_logs")
      .select("date, bed_at, sleep_at, wake_at, quality, ritual_done, notes")
      .eq("user_id", context.userId)
      .order("date", { ascending: false })
      .limit(14);
    if (error) throw new Error(error.message);
    return data;
  });
