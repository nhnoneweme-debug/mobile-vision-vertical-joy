// Server functions da telemetria de execução da jornada.
// Escreve em execution_events (imutável), estende missões via RPC,
// lê o log do dia. Todas autenticadas — o dono é sempre auth.uid().

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const EVENT_KINDS = [
  "manifest_shown",
  "manifest_ack",
  "mission_done",
  "mission_skipped",
  "mission_extended",
  "mission_started",
  "mission_ended",
  "voice_note",
  "negotiation",
  "live_transcript",
  "sensor_reading",
  "journey_log",
  "journey_log_declined",
] as const;

const PHASES = ["preEnd", "atEnd", "preStart", "atStart"] as const;
const CHANNELS = ["foreground", "push", "voice", "manual"] as const;

const jsonValue: z.ZodType<Json> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(z.string(), jsonValue)]),
);

const logSchema = z.object({
  mission_id: z.string().uuid().nullable().optional(),
  kind: z.enum(EVENT_KINDS),
  phase: z.enum(PHASES).nullable().optional(),
  channel: z.enum(CHANNELS).nullable().optional(),
  latency_ms: z.number().int().min(0).max(600_000).nullable().optional(),
  delta_min: z.number().int().min(-240).max(240).nullable().optional(),
  note: z.string().max(4000).nullable().optional(),
  meta: z.record(z.string(), jsonValue).optional(),
});

export type LogExecutionEventInput = z.infer<typeof logSchema>;

export const logExecutionEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => logSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("execution_events").insert({
      user_id: userId,
      mission_id: data.mission_id ?? null,
      kind: data.kind,
      phase: data.phase ?? null,
      channel: data.channel ?? "foreground",
      latency_ms: data.latency_ms ?? null,
      delta_min: data.delta_min ?? null,
      note: data.note ?? null,
      meta: (data.meta ?? {}) as Json,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const extendSchema = z.object({
  mission_id: z.string().uuid(),
  minutes: z.number().int().min(-240).max(240).refine((n) => n !== 0, "no zero"),
});

export const extendMissionToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => extendSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc("extend_mission_today", {
      _mission: data.mission_id,
      _minutes: data.minutes,
    });
    if (error) throw new Error(error.message);
    return (result ?? { ok: false }) as Json;
  });

export type ExecutionEventRow = {
  id: string;
  mission_id: string | null;
  kind: (typeof EVENT_KINDS)[number];
  phase: (typeof PHASES)[number] | null;
  channel: (typeof CHANNELS)[number] | null;
  delta_min: number | null;
  note: string | null;
  meta: Json;
  occurred_at: string;
};

export const getTodayExecutionLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExecutionEventRow[]> => {
    const { supabase, userId } = context;
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, "0");
    const d = String(today.getUTCDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    const { data, error } = await supabase
      .from("execution_events")
      .select("id, mission_id, kind, phase, channel, delta_min, note, meta, occurred_at")
      .eq("user_id", userId)
      .eq("event_date", dateStr)
      .order("occurred_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as ExecutionEventRow[];
  });

/**
 * Eventos do usuário num intervalo arbitrário — usado pela Timeline de hoje,
 * que precisa do DIA LOCAL do aparelho (event_date é UTC e não serve).
 */
const rangeSchema = z.object({
  from: z.string().min(10),
  to: z.string().min(10),
});

export const getExecutionLogRange = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rangeSchema.parse(data))
  .handler(async ({ data, context }): Promise<ExecutionEventRow[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("execution_events")
      .select("id, mission_id, kind, phase, channel, delta_min, note, meta, occurred_at")
      .eq("user_id", userId)
      .gte("occurred_at", data.from)
      .lte("occurred_at", data.to)
      .order("occurred_at", { ascending: true })
      .limit(400);
    if (error) throw new Error(error.message);
    return (rows ?? []) as ExecutionEventRow[];
  });
