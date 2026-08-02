// Motor de Gatilhos da WiMi — modelo de dados + CRUD + avaliação pura.
//
// Um gatilho é uma linha da lista sequencial: CONDIÇÃO → AÇÃO.
// A avaliação acontece no cliente, dentro do painel Live (é lá que estão os
// sinais: transcrição, movimento, timers). Toda execução vira uma linha
// append-only em trigger_firings.

import { supabase } from "@/integrations/supabase/client";

export type TriggerType = "chronos" | "event";

export type TriggerCondition =
  | { mode: "at_time"; time: string }
  | { mode: "every"; seconds: number }
  | { mode: "after_session"; seconds: number }
  | { source: "audio"; keyword: string }
  | { source: "motion"; kind: "spike"; min_magnitude: number }
  | { source: "motion"; kind: "angle_change"; min_degrees: number }
  | { source: "video" };

export type TriggerAction = {
  vibrate?: { onSec: number; everySec?: number; continuous?: boolean };
  audio_tone?: { onSec: number; everySec?: number; continuous?: boolean };
  stop_actuators?: boolean;
  sensors?: { mic?: boolean; camera?: boolean; motion?: boolean };
  message?: string;
};

/** Janela de elegibilidade: horário e/ou dias da semana (0 = domingo). */
export type ActiveWindow = {
  start?: string; // "HH:MM"
  end?: string; // "HH:MM"
  days?: number[]; // 0..6
};

export type TriggerDefinition = {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  position: number;
  trigger_type: TriggerType;
  condition: TriggerCondition;
  action: TriggerAction;
  active_window: ActiveWindow;
  cooldown_seconds: number;
  created_at: string;
  updated_at: string;
};

export type FiringResult = "executed" | "suppressed_cooldown" | "failed" | "simulated";

export type TriggerFiring = {
  id: string;
  trigger_id: string;
  fired_at: string;
  source_kind: string | null;
  source_ref: string | null;
  result: FiringResult;
  meta: Record<string, unknown>;
};

export type TriggerRevision = {
  id: string;
  trigger_id: string;
  revision: number;
  snapshot: Record<string, unknown>;
  change_note: string | null;
  changed_at: string;
};

export const DEFAULT_COOLDOWN = 30;


// ------------------------------------------------------------------ leitura

export async function listTriggers(): Promise<TriggerDefinition[]> {
  const { data, error } = await supabase
    .from("trigger_definitions")
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TriggerDefinition[];
}

export async function listFirings(limit = 25): Promise<TriggerFiring[]> {
  const { data, error } = await supabase
    .from("trigger_firings")
    .select("id, trigger_id, fired_at, source_kind, source_ref, result, meta")
    .order("fired_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TriggerFiring[];
}

// ------------------------------------------------------------------ escrita

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Sessão expirada. Entre novamente.");
  return id;
}

export type TriggerDraft = {
  name: string;
  enabled: boolean;
  trigger_type: TriggerType;
  condition: TriggerCondition;
  action: TriggerAction;
  cooldown_seconds: number;
};

export async function createTrigger(draft: TriggerDraft, position: number) {
  const user_id = await currentUserId();
  const { error } = await supabase.from("trigger_definitions").insert({
    user_id,
    name: draft.name,
    enabled: draft.enabled,
    position,
    trigger_type: draft.trigger_type,
    condition: draft.condition as never,
    action: draft.action as never,
    cooldown_seconds: draft.cooldown_seconds,
  });
  if (error) throw new Error(error.message);
}

export async function updateTrigger(
  id: string,
  patch: Partial<TriggerDraft & { position: number }>,
) {
  const { error } = await supabase
    .from("trigger_definitions")
    .update(patch as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTrigger(id: string) {
  const { error } = await supabase.from("trigger_definitions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reorderTriggers(ordered: TriggerDefinition[]) {
  await Promise.all(ordered.map((t, i) => updateTrigger(t.id, { position: i })));
}

export async function recordFiring(input: {
  trigger_id: string;
  source_kind: string;
  source_ref?: string | null;
  result: FiringResult;
  meta?: Record<string, unknown>;
}) {
  const user_id = await currentUserId();
  const { error } = await supabase.from("trigger_firings").insert({
    user_id,
    trigger_id: input.trigger_id,
    source_kind: input.source_kind,
    source_ref: input.source_ref ?? null,
    result: input.result,
    meta: (input.meta ?? {}) as never,
  });
  // idempotência: violação do índice único (mesmo trigger + mesma origem) é
  // sucesso silencioso — o evento já foi contabilizado.
  if (error && !error.message.includes("duplicate key")) throw new Error(error.message);
}

// -------------------------------------------------------------- sementes

export const SEED_TRIGGERS: TriggerDraft[] = [
  {
    name: "código off",
    enabled: false,
    trigger_type: "event",
    condition: { source: "audio", keyword: "código off" },
    action: { sensors: { mic: false, camera: false, motion: false }, stop_actuators: true },
    cooldown_seconds: 10,
  },
  {
    name: "lembrete a cada 25 min",
    enabled: false,
    trigger_type: "chronos",
    condition: { mode: "every", seconds: 1500 },
    action: { vibrate: { onSec: 2 }, message: "25 minutos de sessão — respira e segue." },
    cooldown_seconds: 60,
  },
];

export async function seedExampleTriggers(existing: TriggerDefinition[]) {
  if (existing.length > 0) return false;
  for (let i = 0; i < SEED_TRIGGERS.length; i += 1) {
    await createTrigger(SEED_TRIGGERS[i], i);
  }
  return true;
}

// ------------------------------------------------------------- descrição

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Match case/acento-insensitive — serve para PT, EN e ES do mesmo jeito. */
export function keywordMatches(text: string, keyword: string): boolean {
  const k = normalize(keyword);
  if (!k) return false;
  return normalize(text).includes(k);
}

export function describeCondition(t: TriggerDefinition): string {
  const c = t.condition as Record<string, unknown>;
  if (c.mode === "at_time") return `todo dia às ${String(c.time)}`;
  if (c.mode === "every") return `a cada ${Math.round(Number(c.seconds) / 60)} min de Live`;
  if (c.mode === "after_session")
    return `após ${Math.round(Number(c.seconds) / 60)} min de sessão Live`;
  if (c.source === "audio") return `quando ouvir "${String(c.keyword)}"`;
  if (c.source === "motion" && c.kind === "spike")
    return `movimento brusco acima de ${String(c.min_magnitude)} m/s²`;
  if (c.source === "motion" && c.kind === "angle_change")
    return `girar o aparelho mais de ${String(c.min_degrees)}°`;
  if (c.source === "video") return "detecção por vídeo (em breve)";
  return "condição desconhecida";
}

export function describeAction(t: TriggerDefinition): string {
  const a = t.action ?? {};
  const parts: string[] = [];
  if (a.vibrate)
    parts.push(a.vibrate.continuous ? "vibrar contínuo" : `vibrar ${a.vibrate.onSec}s`);
  if (a.audio_tone)
    parts.push(a.audio_tone.continuous ? "tom contínuo" : `tom de ${a.audio_tone.onSec}s`);
  if (a.stop_actuators) parts.push("desligar atuadores");
  if (a.sensors) {
    const s = a.sensors;
    const on = Object.entries(s)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    const off = Object.entries(s)
      .filter(([, v]) => v === false)
      .map(([k]) => k);
    if (on.length) parts.push(`ligar ${on.join("/")}`);
    if (off.length) parts.push(`desligar ${off.join("/")}`);
  }
  if (a.message) parts.push(`avisar "${a.message}"`);
  return parts.length ? parts.join(" + ") : "nenhuma ação";
}
