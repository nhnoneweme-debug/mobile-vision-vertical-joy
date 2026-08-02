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
  /** Abre o Log de Jornada ("o que você está executando agora?"). */
  journey_log_prompt?: boolean;
  /** Ação personalizada descrita em linguagem natural e interpretada pela IA. */
  custom?: { instruction: string; plan?: string };
  /** ELEMENTO PROMPT — instrução em linguagem natural executada pela LLM no disparo. */
  prompt?: { instruction: string };
  /** ENCADEAMENTO — executa as ações de outro gatilho imediatamente. */
  trigger_fire?: { trigger_id: string };
  /** ENCADEAMENTO — arma/desarma outro gatilho. */
  trigger_enable?: { trigger_id: string; enabled: boolean };
};

/** Profundidade máxima de encadeamento entre gatilhos (proteção anti-ciclo). */
export const MAX_CHAIN_DEPTH = 3;



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
  active_window?: ActiveWindow;
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
    active_window: (draft.active_window ?? {}) as never,
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

// ------------------------------------------------------------ versões

export async function listRevisions(triggerId: string): Promise<TriggerRevision[]> {
  const { data, error } = await supabase
    .from("trigger_revisions")
    .select("id, trigger_id, revision, snapshot, change_note, changed_at")
    .eq("trigger_id", triggerId)
    .order("revision", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TriggerRevision[];
}

/** Grava o estado ATUAL do gatilho como revisão (chamado antes de aplicar a edição). */
export async function snapshotTrigger(current: TriggerDefinition, note?: string) {
  const user_id = await currentUserId();
  const { data } = await supabase
    .from("trigger_revisions")
    .select("revision")
    .eq("trigger_id", current.id)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = ((data?.revision as number | undefined) ?? 0) + 1;
  const { error } = await supabase.from("trigger_revisions").insert({
    user_id,
    trigger_id: current.id,
    revision: next,
    change_note: note ?? null,
    snapshot: {
      name: current.name,
      enabled: current.enabled,
      trigger_type: current.trigger_type,
      condition: current.condition,
      action: current.action,
      active_window: current.active_window ?? {},
      cooldown_seconds: current.cooldown_seconds,
    } as never,
  });
  if (error) throw new Error(error.message);
  return next;
}

/** Edição versionada: guarda a versão anterior e depois aplica o patch. */
export async function updateTriggerVersioned(
  current: TriggerDefinition,
  patch: Partial<TriggerDraft>,
  note?: string,
) {
  await snapshotTrigger(current, note ?? "edição");
  await updateTrigger(current.id, patch);
}

/** Restaurar uma versão também gera revisão — nada se apaga. */
export async function restoreRevision(current: TriggerDefinition, rev: TriggerRevision) {
  const s = rev.snapshot as unknown as TriggerDraft;
  await snapshotTrigger(current, `restaurando v${rev.revision}`);
  await updateTrigger(current.id, {
    name: s.name,
    enabled: s.enabled,
    trigger_type: s.trigger_type,
    condition: s.condition,
    action: s.action,
    active_window: s.active_window ?? {},
    cooldown_seconds: s.cooldown_seconds,
  });
}

export async function duplicateTrigger(t: TriggerDefinition, position: number) {
  await createTrigger(
    {
      name: `${t.name} (cópia)`,
      enabled: false,
      trigger_type: t.trigger_type,
      condition: t.condition,
      action: t.action,
      active_window: t.active_window ?? {},
      cooldown_seconds: t.cooldown_seconds,
    },
    position,
  );
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
    // Nível 1: fecha os sensores "de fora", mas mantém os ouvidos abertos
    // para poder receber o próximo código.
    name: "código off",
    enabled: true,
    trigger_type: "event",
    condition: { source: "audio", keyword: "código off" },
    action: {
      sensors: { camera: false, motion: false },
      stop_actuators: true,
      message: "sensores desligados — microfone segue ouvindo.",
    },
    cooldown_seconds: 10,
  },
  {
    // Nível 2: silêncio total, o microfone morre por último.
    name: "código off total",
    enabled: true,
    trigger_type: "event",
    condition: { source: "audio", keyword: "código off total" },
    action: {
      sensors: { mic: false, camera: false, motion: false },
      stop_actuators: true,
      message: "tudo desligado — inclusive o microfone.",
    },
    cooldown_seconds: 10,
  },
  {
    name: "Log de jornada",
    enabled: true,
    trigger_type: "chronos",
    condition: { mode: "every", seconds: 1800 },
    action: { journey_log_prompt: true, vibrate: { onSec: 1 } },
    cooldown_seconds: 300,
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

/**
 * Elementos de execução do gatilho, na ordem em que o motor os aplica.
 * Primitivas + Prompt (LLM) + encadeamentos, tudo na mesma lista.
 */
export function actionElements(
  a: TriggerAction | null | undefined,
  names: Record<string, string> = {},
): string[] {
  const act = a ?? {};
  const parts: string[] = [];
  if (act.vibrate)
    parts.push(act.vibrate.continuous ? "vibrar contínuo" : `vibrar ${act.vibrate.onSec}s`);
  if (act.audio_tone)
    parts.push(act.audio_tone.continuous ? "tom contínuo" : `tom de ${act.audio_tone.onSec}s`);
  if (act.stop_actuators) parts.push("desligar atuadores");
  if (act.sensors) {
    const s = act.sensors;
    const on = Object.entries(s)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    const off = Object.entries(s)
      .filter(([, v]) => v === false)
      .map(([k]) => k);
    if (on.length) parts.push(`ligar ${on.join("/")}`);
    if (off.length) parts.push(`desligar ${off.join("/")}`);
  }
  if (act.journey_log_prompt) parts.push("abrir log de jornada");
  if (act.custom) parts.push(`ação personalizada: ${act.custom.plan ?? act.custom.instruction}`);
  if (act.prompt?.instruction) parts.push(`Prompt("${act.prompt.instruction}")`);
  if (act.trigger_fire?.trigger_id)
    parts.push(
      `acionar "${names[act.trigger_fire.trigger_id] ?? "outro gatilho"}"`,
    );
  if (act.trigger_enable?.trigger_id)
    parts.push(
      `${act.trigger_enable.enabled ? "armar" : "desarmar"} "${
        names[act.trigger_enable.trigger_id] ?? "outro gatilho"
      }"`,
    );
  if (act.message) parts.push(`avisar "${act.message}"`);
  return parts;
}

export function describeAction(
  t: Pick<TriggerDefinition, "action">,
  names: Record<string, string> = {},
): string {
  const parts = actionElements(t.action, names);
  return parts.length ? parts.join(" + ") : "nenhuma ação";
}

// ------------------------------------------------------------ janela ativa

const DAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Janela vazia = sempre elegível. Suporta janelas que cruzam a meia-noite. */
export function isWithinWindow(w: ActiveWindow | null | undefined, at: Date = new Date()): boolean {
  if (!w || (!w.start && !w.end && !(w.days && w.days.length))) return true;
  if (w.days && w.days.length && !w.days.includes(at.getDay())) return false;
  const start = w.start ? toMinutes(w.start) : null;
  const end = w.end ? toMinutes(w.end) : null;
  if (start == null || end == null) return true;
  const now = at.getHours() * 60 + at.getMinutes();
  if (start === end) return true;
  if (start < end) return now >= start && now <= end;
  return now >= start || now <= end; // cruza a meia-noite
}

export function describeWindow(w: ActiveWindow | null | undefined): string | null {
  if (!w) return null;
  const parts: string[] = [];
  if (w.start && w.end) parts.push(`entre ${w.start}–${w.end}`);
  if (w.days && w.days.length && w.days.length < 7) {
    parts.push(`em ${w.days.slice().sort().map((d) => DAY_LABELS[d]).join("/")}`);
  }
  return parts.length ? parts.join(", ") : null;
}

/** Resumo legível completo, usado no preview ao vivo do Studio. */
export function describeTrigger(
  t: {
    condition: TriggerCondition;
    action: TriggerAction;
    active_window?: ActiveWindow;
    cooldown_seconds?: number;
  },
  names: Record<string, string> = {},
): string {
  const fake = t as TriggerDefinition;
  const win = describeWindow(t.active_window);
  return `${describeCondition(fake)}${win ? `, ${win}` : ""} → ${describeAction(fake, names)}`;
}

// -------------------------------------------------------- biblioteca

export type TriggerTemplate = { id: string; label: string; hint: string; draft: TriggerDraft };

export const TRIGGER_TEMPLATES: TriggerTemplate[] = [
  {
    id: "codigo-off",
    label: "Código off",
    hint: "palavra-chave desliga todos os sensores",
    draft: {
      name: "código off",
      enabled: false,
      trigger_type: "event",
      condition: { source: "audio", keyword: "código off" },
      action: { sensors: { mic: false, camera: false, motion: false }, stop_actuators: true },
      cooldown_seconds: 10,
    },
  },
  {
    id: "so-ouvidos",
    label: "Código só ouvidos",
    hint: "desliga câmera e movimento, mantém o mic",
    draft: {
      name: "código só ouvidos",
      enabled: false,
      trigger_type: "event",
      condition: { source: "audio", keyword: "só ouvidos" },
      action: { sensors: { camera: false, motion: false } },
      cooldown_seconds: 10,
    },
  },
  {
    id: "pomodoro",
    label: "Pomodoro 25/5",
    hint: "a cada 25 min de Live: vibra + mensagem",
    draft: {
      name: "pomodoro 25/5",
      enabled: false,
      trigger_type: "chronos",
      condition: { mode: "every", seconds: 1500 },
      action: { vibrate: { onSec: 2 }, message: "25 min. Pausa de 5 e volta." },
      cooldown_seconds: 60,
    },
  },
  {
    id: "hidratacao",
    label: "Hidratação",
    hint: "a cada 60 min: sino + mensagem",
    draft: {
      name: "hidratação",
      enabled: false,
      trigger_type: "chronos",
      condition: { mode: "every", seconds: 3600 },
      action: { audio_tone: { onSec: 1 }, message: "Bebe água." },
      cooldown_seconds: 300,
    },
  },
  {
    id: "sentinela",
    label: "Sentinela de movimento",
    hint: "pico ≥ 8 m/s²: mensagem + sino",
    draft: {
      name: "sentinela de movimento",
      enabled: false,
      trigger_type: "event",
      condition: { source: "motion", kind: "spike", min_magnitude: 8 },
      action: { audio_tone: { onSec: 1 }, message: "Movimento brusco detectado." },
      cooldown_seconds: 30,
    },
  },
];

// -------------------------------------------------------- estatísticas

export type TriggerStats = { total: number; today: number; last: string | null };

export function computeStats(firings: TriggerFiring[]): Record<string, TriggerStats> {
  const todayKey = new Date().toDateString();
  const map: Record<string, TriggerStats> = {};
  for (const f of firings) {
    if (f.result === "suppressed_cooldown") continue;
    const s = (map[f.trigger_id] ??= { total: 0, today: 0, last: null });
    s.total += 1;
    if (new Date(f.fired_at).toDateString() === todayKey) s.today += 1;
    if (!s.last || f.fired_at > s.last) s.last = f.fired_at;
  }
  return map;
}

// ------------------------------------------------------ agenda do chronos

/**
 * Próximo disparo (em ms epoch) de um gatilho chronos, ou null quando não
 * se aplica. Base do diagnóstico visível e do overlay de próximas ações.
 */
export function nextChronosFireAt(
  t: Pick<TriggerDefinition, "condition">,
  sessionStartedAt: number,
  now: number = Date.now(),
): number | null {
  const c = t.condition as Record<string, unknown>;
  if (c?.mode === "every") {
    const secs = Math.max(10, Number(c.seconds ?? 60)) * 1000;
    const elapsed = Math.max(0, now - sessionStartedAt);
    const n = Math.floor(elapsed / secs) + 1;
    return sessionStartedAt + n * secs;
  }
  if (c?.mode === "after_session") {
    const secs = Math.max(10, Number(c.seconds ?? 60)) * 1000;
    const at = sessionStartedAt + secs;
    return at > now ? at : null;
  }
  if (c?.mode === "at_time" && typeof c.time === "string") {
    const m = /^(\d{1,2}):(\d{2})$/.exec(c.time);
    if (!m) return null;
    const d = new Date(now);
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  return null;
}

/** "12:34" / "1h02" — formatação de contagem regressiva. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type UpcomingAction = {
  trigger: TriggerDefinition;
  /** ms até o disparo (chronos) ou null quando é gatilho de evento. */
  etaMs: number | null;
  when: string;
};

/**
 * Fila ordenada de próximas ações: chronos elegíveis por proximidade, depois
 * os gatilhos de evento na ordem sequencial (position).
 */
export function upcomingActions(
  triggers: TriggerDefinition[],
  sessionStartedAt: number,
  now: number = Date.now(),
): UpcomingAction[] {
  const eligible = triggers
    .filter((t) => t.enabled && isWithinWindow(t.active_window, new Date(now)))
    .sort((a, b) => a.position - b.position);

  const chronos: UpcomingAction[] = [];
  const events: UpcomingAction[] = [];

  for (const t of eligible) {
    const at = nextChronosFireAt(t, sessionStartedAt, now);
    if (at != null) {
      chronos.push({ trigger: t, etaMs: at - now, when: `em ${formatCountdown(at - now)}` });
    } else {
      const c = t.condition as Record<string, unknown>;
      const when =
        c?.source === "audio"
          ? `aguardando: "${String(c.keyword)}"`
          : c?.source === "motion"
            ? "aguardando movimento"
            : "aguardando sinal";
      events.push({ trigger: t, etaMs: null, when });
    }
  }

  chronos.sort((a, b) => (a.etaMs ?? 0) - (b.etaMs ?? 0));
  return [...chronos, ...events];
}
