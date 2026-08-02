// Gatilho Studio — construtor guiado, biblioteca de modelos, teste simulado,
// versões (append-only) e estatísticas por gatilho.
// A avaliação em tempo real continua acontecendo no painel Live.

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  History,
  LibraryBig,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_COOLDOWN,
  TRIGGER_TEMPLATES,
  computeStats,
  createTrigger,
  deleteTrigger,
  describeAction,
  describeCondition,
  describeTrigger,
  describeWindow,
  duplicateTrigger,
  formatCountdown,
  listFirings,
  listRevisions,
  listTriggers,
  nextChronosFireAt,
  recordFiring,
  reorderTriggers,
  restoreRevision,
  updateTrigger,
  updateTriggerVersioned,
  type ActiveWindow,
  type TriggerAction,
  type TriggerCondition,
  type TriggerDefinition,
  type TriggerDraft,
  type TriggerRevision,
} from "@/lib/triggers";
import { useActuators } from "@/providers/ActuatorsProvider";
import { useLiveSessionStart, useSecondsTick } from "@/hooks/useLiveSession";
import { SpeakTriggerSheet } from "./SpeakTriggerSheet";
import { CustomActionBox } from "./CustomActionBox";

type CondKind =
  | "at_time"
  | "every"
  | "after_session"
  | "audio"
  | "motion_spike"
  | "motion_angle"
  | "video";

type Source = "chronos" | "audio" | "motion" | "video";

const SOURCE_LABEL: Record<Source, string> = {
  chronos: "Cronos",
  audio: "Áudio",
  motion: "Movimento",
  video: "Vídeo (em breve)",
};

const COND_LABEL: Record<CondKind, string> = {
  at_time: "hora do dia",
  every: "a cada X min de Live",
  after_session: "após X min de sessão",
  audio: "palavra-chave no áudio",
  motion_spike: "movimento brusco (pico)",
  motion_angle: "mudança de ângulo",
  video: "detecção por vídeo",
};

const DAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

type FormState = {
  id: string | null;
  name: string;
  source: Source;
  kind: CondKind;
  time: string;
  minutes: number;
  keyword: string;
  magnitude: number;
  degrees: number;
  cooldown: number;
  vibrate: boolean;
  vibrateSec: number;
  tone: boolean;
  toneSec: number;
  stopActuators: boolean;
  micOff: boolean;
  cameraOff: boolean;
  motionOff: boolean;
  message: string;
  journeyLog: boolean;
  customInstruction: string;
  customPlan: string | null;
  customAction: TriggerAction | null;
  useWindow: boolean;
  winStart: string;
  winEnd: string;
  days: number[];
};

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  source: "audio",
  kind: "audio",
  time: "08:00",
  minutes: 25,
  keyword: "",
  magnitude: 8,
  degrees: 45,
  cooldown: DEFAULT_COOLDOWN,
  vibrate: false,
  vibrateSec: 2,
  tone: false,
  toneSec: 1,
  stopActuators: false,
  micOff: false,
  cameraOff: false,
  motionOff: false,
  message: "",
  journeyLog: false,
  customInstruction: "",
  customPlan: null,
  customAction: null,
  useWindow: false,
  winStart: "08:00",
  winEnd: "18:00",
  days: [],
};

function kindsFor(source: Source): CondKind[] {
  if (source === "chronos") return ["at_time", "every", "after_session"];
  if (source === "audio") return ["audio"];
  if (source === "motion") return ["motion_spike", "motion_angle"];
  return ["video"];
}

function buildCondition(f: FormState): TriggerCondition {
  switch (f.kind) {
    case "at_time":
      return { mode: "at_time", time: f.time };
    case "every":
      return { mode: "every", seconds: Math.max(1, f.minutes) * 60 };
    case "after_session":
      return { mode: "after_session", seconds: Math.max(1, f.minutes) * 60 };
    case "motion_spike":
      return { source: "motion", kind: "spike", min_magnitude: f.magnitude };
    case "motion_angle":
      return { source: "motion", kind: "angle_change", min_degrees: f.degrees };
    case "video":
      return { source: "video" };
    default:
      return { source: "audio", keyword: f.keyword };
  }
}

function buildAction(f: FormState): TriggerAction {
  const a: TriggerAction = {};
  if (f.vibrate) a.vibrate = { onSec: f.vibrateSec };
  if (f.tone) a.audio_tone = { onSec: f.toneSec };
  if (f.stopActuators) a.stop_actuators = true;
  const sensors: Record<string, boolean> = {};
  if (f.micOff) sensors.mic = false;
  if (f.cameraOff) sensors.camera = false;
  if (f.motionOff) sensors.motion = false;
  if (Object.keys(sensors).length) a.sensors = sensors;
  if (f.journeyLog) a.journey_log_prompt = true;
  if (f.customInstruction.trim()) {
    // As primitivas interpretadas pela IA entram como base; a instrução crua
    // fica guardada para a WiMi compor a manifestação no disparo.
    Object.assign(a, f.customAction ?? {});
    a.custom = { instruction: f.customInstruction.trim(), plan: f.customPlan ?? undefined };
  }
  if (f.message.trim()) a.message = f.message.trim();
  return a;
}

function buildWindow(f: FormState): ActiveWindow {
  if (!f.useWindow) return {};
  const w: ActiveWindow = { start: f.winStart, end: f.winEnd };
  if (f.days.length && f.days.length < 7) w.days = [...f.days].sort();
  return w;
}

function buildDraft(f: FormState): TriggerDraft {
  return {
    name: f.name.trim(),
    enabled: true,
    trigger_type: f.source === "chronos" ? "chronos" : "event",
    condition: buildCondition(f),
    action: buildAction(f),
    active_window: buildWindow(f),
    cooldown_seconds: f.cooldown,
  };
}

function formFromTrigger(t: TriggerDefinition): FormState {
  const c = t.condition as Record<string, unknown>;
  const a = t.action ?? {};
  const w = t.active_window ?? {};
  let source: Source = "audio";
  let kind: CondKind = "audio";
  if (c.mode) {
    source = "chronos";
    kind = c.mode as CondKind;
  } else if (c.source === "motion") {
    source = "motion";
    kind = c.kind === "angle_change" ? "motion_angle" : "motion_spike";
  } else if (c.source === "video") {
    source = "video";
    kind = "video";
  }
  return {
    ...EMPTY_FORM,
    id: t.id,
    name: t.name,
    source,
    kind,
    time: typeof c.time === "string" ? c.time : "08:00",
    minutes: c.seconds ? Math.round(Number(c.seconds) / 60) : 25,
    keyword: typeof c.keyword === "string" ? c.keyword : "",
    magnitude: Number(c.min_magnitude ?? 8),
    degrees: Number(c.min_degrees ?? 45),
    cooldown: t.cooldown_seconds,
    vibrate: !!a.vibrate,
    vibrateSec: a.vibrate?.onSec ?? 2,
    tone: !!a.audio_tone,
    toneSec: a.audio_tone?.onSec ?? 1,
    stopActuators: !!a.stop_actuators,
    micOff: a.sensors?.mic === false,
    cameraOff: a.sensors?.camera === false,
    motionOff: a.sensors?.motion === false,
    message: a.message ?? "",
    journeyLog: !!a.journey_log_prompt,
    customInstruction: a.custom?.instruction ?? "",
    customPlan: a.custom?.plan ?? null,
    customAction: null,
    useWindow: !!(w.start && w.end),
    winStart: w.start ?? "08:00",
    winEnd: w.end ?? "18:00",
    days: w.days ?? [],
  };
}

export function TriggersSection() {
  const qc = useQueryClient();
  const actuators = useActuators();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [versionsFor, setVersionsFor] = useState<string | null>(null);
  const [speakOpen, setSpeakOpen] = useState(false);
  const sessionStartedAt = useLiveSessionStart();
  const tick = useSecondsTick();

  const triggersQ = useQuery({ queryKey: ["triggers"], queryFn: listTriggers });
  const firingsQ = useQuery({ queryKey: ["trigger-firings"], queryFn: () => listFirings(200) });

  const triggers = useMemo(
    () => [...(triggersQ.data ?? [])].sort((a, b) => a.position - b.position),
    [triggersQ.data],
  );

  const stats = useMemo(() => computeStats(firingsQ.data ?? []), [firingsQ.data]);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["triggers"] });
    void qc.invalidateQueries({ queryKey: ["trigger-firings"] });
    void qc.invalidateQueries({ queryKey: ["trigger-revisions"] });
  }, [qc]);

  const saveM = useMutation({
    mutationFn: async (f: FormState) => {
      const draft = buildDraft(f);
      if (f.id) {
        const current = triggers.find((t) => t.id === f.id);
        if (!current) throw new Error("Gatilho não encontrado.");
        await updateTriggerVersioned(current, { ...draft, enabled: current.enabled });
      } else {
        await createTrigger(draft, triggers.length);
      }
    },
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setOpen(false);
      invalidate();
      toast.success("Gatilho salvo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleM = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateTrigger(id, { enabled }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteTrigger(id),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderM = useMutation({
    mutationFn: (ordered: TriggerDefinition[]) => reorderTriggers(ordered),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const templateM = useMutation({
    mutationFn: (draft: TriggerDraft) => createTrigger(draft, triggers.length),
    onSuccess: () => {
      invalidate();
      toast.success("Modelo aplicado (desligado) — revise e ligue.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dupM = useMutation({
    mutationFn: (t: TriggerDefinition) => duplicateTrigger(t, triggers.length),
    onSuccess: () => {
      invalidate();
      toast.success("Gatilho duplicado (desligado).");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Teste simulado: executa as ações agora, ignorando condição e cooldown. */
  const simulate = useCallback(
    async (t: TriggerDefinition) => {
      const a = t.action ?? {};
      try {
        if (a.stop_actuators) actuators.stopAll();
        if (a.vibrate) {
          actuators.setVibrationConfig({
            onSec: Math.min(10, Math.max(1, a.vibrate.onSec ?? 2)),
            everySec: 30,
            mode: "timed",
            sound: "soft",
          });
          actuators.setVibration(true);
          window.setTimeout(() => actuators.setVibration(false), (a.vibrate.onSec ?? 2) * 1000);
        }
        if (a.audio_tone) {
          actuators.setAudioConfig({
            onSec: Math.min(10, Math.max(1, a.audio_tone.onSec ?? 1)),
            everySec: 30,
            mode: "timed",
            sound: "bell",
          });
          actuators.setAudio(true);
          window.setTimeout(() => actuators.setAudio(false), (a.audio_tone.onSec ?? 1) * 1000);
        }
        if (a.message) toast(a.message);
        if (a.sensors) {
          toast.info("Ações de sensor só têm efeito com o painel Live aberto.");
        }
        await recordFiring({
          trigger_id: t.id,
          source_kind: "simulation",
          source_ref: `sim:${Date.now()}`,
          result: "simulated",
          meta: { simulated: true },
        });
      } catch (e) {
        toast.error((e as Error).message);
      }
      invalidate();
    },
    [actuators, invalidate],
  );

  const move = (index: number, dir: -1 | 1) => {
    const next = [...triggers];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorderM.mutate(next);
  };

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of triggers) m[t.id] = t.name;
    return m;
  }, [triggers]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-charcoal-900/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <Zap className="h-3.5 w-3.5 shrink-0" /> Gatilho Studio
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Avaliados na ordem, de cima pra baixo, enquanto o painel Live está aberto.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0">
            <button
              type="button"
              onClick={() => setSpeakOpen(true)}
              className="flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-ember/40 bg-ember/10 px-2 py-2 text-[11px] text-ember active:scale-95 sm:px-3 sm:text-xs"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Falando</span>
            </button>
            <button
              type="button"
              onClick={() => setLibOpen((v) => !v)}
              className="flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-border px-2 py-2 text-[11px] text-muted-foreground active:scale-95 sm:px-3 sm:text-xs"
            >
              <LibraryBig className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Modelos</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(EMPTY_FORM);
                setOpen(true);
              }}
              className="flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-ember/40 bg-ember/10 px-2 py-2 text-[11px] text-ember active:scale-95 sm:px-3 sm:text-xs"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Novo</span>
            </button>
          </div>
        </div>


        {libOpen ? (
          <ul className="mt-3 space-y-2">
            {TRIGGER_TEMPLATES.map((tpl) => (
              <li
                key={tpl.id}
                className="flex items-center gap-2 rounded-xl border border-border bg-charcoal-950/30 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{tpl.label}</p>
                  <p className="text-[11px] text-muted-foreground">{tpl.hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() => templateM.mutate(tpl.draft)}
                  className="shrink-0 rounded-full border border-ember/40 bg-ember/10 px-3 py-1.5 text-[11px] text-ember active:scale-95"
                >
                  Aplicar
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {triggersQ.isLoading ? (
          <p className="mt-3 text-[12px] text-muted-foreground">carregando…</p>
        ) : triggers.length === 0 ? (
          <p className="mt-3 rounded-xl border border-border/60 bg-charcoal-950/40 p-3 text-[12px] text-muted-foreground">
            Nenhum gatilho ainda. Comece pela biblioteca de <strong>Modelos</strong> ou crie um no
            construtor.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {triggers.map((t, i) => {
              const s = stats[t.id];
              const win = describeWindow(t.active_window);
              return (
                <li
                  key={t.id}
                  className={`rounded-xl border p-3 ${
                    t.enabled ? "border-ember/40 bg-ember/5" : "border-border bg-charcoal-950/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 font-display text-[11px] text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{t.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {describeCondition(t)}
                        {win ? `, ${win}` : ""} → {describeAction(t)}
                      </p>
                      {t.enabled && nextChronosFireAt(t, sessionStartedAt, tick) != null ? (
                        <p className="mt-0.5 text-[11px] text-ember">
                          próximo disparo em{" "}
                          {formatCountdown(
                            (nextChronosFireAt(t, sessionStartedAt, tick) as number) - tick,
                          )}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        cooldown {t.cooldown_seconds}s · {s?.total ?? 0} total · {s?.today ?? 0} hoje
                        {s?.last
                          ? ` · último ${new Date(s.last).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() => toggleM.mutate({ id: t.id, enabled: !t.enabled })}
                        aria-pressed={t.enabled}
                        className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wide ${
                          t.enabled
                            ? "bg-ember/20 text-ember"
                            : "bg-charcoal-800 text-muted-foreground"
                        }`}
                      >
                        {t.enabled ? "on" : "off"}
                      </button>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          aria-label="Subir"
                          onClick={() => move(i, -1)}
                          className="rounded-md border border-border p-1 text-muted-foreground active:scale-95"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Descer"
                          onClick={() => move(i, 1)}
                          className="rounded-md border border-border p-1 text-muted-foreground active:scale-95"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Excluir"
                          onClick={() => deleteM.mutate(t.id)}
                          className="rounded-md border border-border p-1 text-destructive active:scale-95"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <MiniBtn icon={Play} label="Testar agora" onClick={() => void simulate(t)} />
                    <MiniBtn
                      icon={Pencil}
                      label="Editar"
                      onClick={() => {
                        setForm(formFromTrigger(t));
                        setOpen(true);
                      }}
                    />
                    <MiniBtn icon={Copy} label="Duplicar" onClick={() => dupM.mutate(t)} />
                    <MiniBtn
                      icon={History}
                      label="Versões"
                      onClick={() => setVersionsFor(versionsFor === t.id ? null : t.id)}
                    />
                  </div>

                  {versionsFor === t.id ? <RevisionList trigger={t} onDone={invalidate} /> : null}
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-3 text-[11px] text-muted-foreground">
          Live pausado = avaliador pausado. Até os gatilhos de hora do dia só disparam com o painel
          Live aberto — não há execução em segundo plano nesta fatia.
        </p>
      </section>

      {open ? (
        <section className="rounded-2xl border border-ember/30 bg-charcoal-900/60 p-4">
          <h3 className="font-display text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {form.id ? "Editar gatilho" : "Construtor de gatilho"}
          </h3>

          <Step n={1} title="Nome">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ex.: código off"
              className="w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground outline-none"
            />
          </Step>

          <Step n={2} title="Fonte">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SOURCE_LABEL) as Source[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={s === "video"}
                  onClick={() => setForm({ ...form, source: s, kind: kindsFor(s)[0] })}
                  className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-wide disabled:opacity-40 ${
                    form.source === s
                      ? "bg-ember/15 text-ember ring-1 ring-ember/40"
                      : "text-muted-foreground ring-1 ring-border"
                  }`}
                >
                  {SOURCE_LABEL[s]}
                </button>
              ))}
            </div>
          </Step>

          <Step n={3} title="Condição">
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as CondKind })}
              className="w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground outline-none"
            >
              {kindsFor(form.source).map((k) => (
                <option key={k} value={k}>
                  {COND_LABEL[k]}
                </option>
              ))}
            </select>

            {form.kind === "at_time" ? (
              <Field label="hora">
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground"
                />
              </Field>
            ) : null}
            {form.kind === "every" || form.kind === "after_session" ? (
              <Field label="minutos">
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={form.minutes}
                  onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground"
                />
              </Field>
            ) : null}
            {form.kind === "audio" ? (
              <Field label="palavra ou frase (ignora maiúsculas e acentos)">
                <input
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                  placeholder="ex.: código off"
                  className="w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground"
                />
              </Field>
            ) : null}
            {form.kind === "motion_spike" ? (
              <Field label="magnitude mínima (m/s²)">
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={form.magnitude}
                  onChange={(e) => setForm({ ...form, magnitude: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground"
                />
              </Field>
            ) : null}
            {form.kind === "motion_angle" ? (
              <Field label="variação mínima de ângulo (graus)">
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={form.degrees}
                  onChange={(e) => setForm({ ...form, degrees: Number(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground"
                />
              </Field>
            ) : null}
          </Step>

          <Step n={4} title="Ações (pode combinar)">
            <div className="space-y-2">
              <CheckRow
                label="Vibrar"
                checked={form.vibrate}
                onChange={(v) => setForm({ ...form, vibrate: v })}
              >
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.vibrateSec}
                  onChange={(e) => setForm({ ...form, vibrateSec: Number(e.target.value) })}
                  className="w-16 rounded-lg border border-border bg-charcoal-950/60 px-2 py-1 text-sm text-foreground"
                />
              </CheckRow>
              <CheckRow
                label="Tom de áudio"
                checked={form.tone}
                onChange={(v) => setForm({ ...form, tone: v })}
              >
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.toneSec}
                  onChange={(e) => setForm({ ...form, toneSec: Number(e.target.value) })}
                  className="w-16 rounded-lg border border-border bg-charcoal-950/60 px-2 py-1 text-sm text-foreground"
                />
              </CheckRow>
              <CheckRow
                label="Desligar atuadores"
                checked={form.stopActuators}
                onChange={(v) => setForm({ ...form, stopActuators: v })}
              />
              <CheckRow
                label="Desligar microfone"
                checked={form.micOff}
                onChange={(v) => setForm({ ...form, micOff: v })}
              />
              <CheckRow
                label="Desligar câmera"
                checked={form.cameraOff}
                onChange={(v) => setForm({ ...form, cameraOff: v })}
              />
              <CheckRow
                label="Desligar movimento"
                checked={form.motionOff}
                onChange={(v) => setForm({ ...form, motionOff: v })}
              />
              <CheckRow
                label="Abrir Log de jornada"
                checked={form.journeyLog}
                onChange={(v) => setForm({ ...form, journeyLog: v })}
              />
              <CheckRow
                label="Ação personalizada (IA)"
                checked={!!form.customInstruction || form.customPlan != null}
                onChange={(v) =>
                  setForm({
                    ...form,
                    customInstruction: v ? form.customInstruction : "",
                    customPlan: v ? form.customPlan : null,
                    customAction: v ? form.customAction : null,
                  })
                }
              />
            </div>
            {form.customInstruction || form.customPlan != null ? (
              <CustomActionBox
                instruction={form.customInstruction}
                plan={form.customPlan}
                contextHint="Sessão Live do painel Executando (microfone, movimento, câmera, atuadores)."
                onChange={(next) =>
                  setForm((f) => ({
                    ...f,
                    customInstruction: next.instruction,
                    customPlan: next.plan,
                    customAction: next.action,
                  }))
                }
              />
            ) : null}
            <Field label="mensagem (opcional)">
              <input
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground"
              />
            </Field>
          </Step>

          <Step n={5} title="Cooldown">
            <input
              type="number"
              min={0}
              max={3600}
              value={form.cooldown}
              onChange={(e) => setForm({ ...form, cooldown: Number(e.target.value) })}
              className="w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground"
            />
          </Step>

          <Step n={6} title="Janela ativa (opcional)">
            <CheckRow
              label="Só valer dentro de uma janela"
              checked={form.useWindow}
              onChange={(v) => setForm({ ...form, useWindow: v })}
            />
            {form.useWindow ? (
              <>
                <div className="mt-2 flex gap-2">
                  <input
                    type="time"
                    value={form.winStart}
                    onChange={(e) => setForm({ ...form, winStart: e.target.value })}
                    className="flex-1 rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground"
                  />
                  <input
                    type="time"
                    value={form.winEnd}
                    onChange={(e) => setForm({ ...form, winEnd: e.target.value })}
                    className="flex-1 rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DAYS.map((d, i) => {
                    const on = form.days.includes(i);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            days: on ? form.days.filter((x) => x !== i) : [...form.days, i],
                          })
                        }
                        className={`rounded-full px-2.5 py-1 text-[10px] uppercase ${
                          on
                            ? "bg-ember/15 text-ember ring-1 ring-ember/40"
                            : "text-muted-foreground ring-1 ring-border"
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  nenhum dia marcado = todos os dias
                </p>
              </>
            ) : null}
          </Step>

          <div className="mt-4 rounded-xl border border-ember/30 bg-ember/5 p-3">
            <p className="font-display text-[10px] uppercase tracking-[0.16em] text-ember">
              preview
            </p>
            <p className="mt-1 text-[12px] text-foreground">
              {describeTrigger({
                condition: buildCondition(form),
                action: buildAction(form),
                active_window: buildWindow(form),
              })}
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={!form.name.trim() || saveM.isPending}
              onClick={() => saveM.mutate(form)}
              className="flex-1 rounded-xl border border-ember/40 bg-ember/10 py-2.5 text-sm text-ember disabled:opacity-40 active:scale-95"
            >
              {form.id ? "Salvar edição (gera versão)" : "Salvar gatilho"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setForm(EMPTY_FORM);
              }}
              className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground active:scale-95"
            >
              Cancelar
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-charcoal-900/60 p-4">
        <h3 className="font-display text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Histórico de disparos
        </h3>
        {(firingsQ.data ?? []).length === 0 ? (
          <p className="mt-2 text-[12px] text-muted-foreground">nenhum disparo registrado ainda</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {(firingsQ.data ?? []).slice(0, 30).map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-[12px]">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {new Date(f.fired_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {nameById[f.trigger_id] ?? "gatilho removido"}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                    f.result === "executed"
                      ? "bg-ember/15 text-ember"
                      : f.result === "simulated"
                        ? "bg-sky-500/15 text-sky-400"
                        : f.result === "failed"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-charcoal-800 text-muted-foreground"
                  }`}
                >
                  {f.result === "executed"
                    ? "executado"
                    : f.result === "simulated"
                      ? "simulado"
                      : f.result === "failed"
                        ? "falhou"
                        : "cooldown"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {speakOpen ? (
        <SpeakTriggerSheet
          onClose={() => setSpeakOpen(false)}
          onUse={(d) => {
            setForm({
              ...EMPTY_FORM,
              ...formFromTrigger({
                id: "",
                user_id: "",
                name: d.name,
                enabled: true,
                position: 0,
                trigger_type: d.trigger_type,
                condition: d.condition,
                action: d.action,
                active_window: d.active_window ?? {},
                cooldown_seconds: d.cooldown_seconds,
                created_at: "",
                updated_at: "",
              }),
              id: null,
            });
            setSpeakOpen(false);
            setOpen(true);
            toast("Rascunho pronto — revise e salve.");
          }}
        />
      ) : null}
    </div>
  );
}

function RevisionList({ trigger, onDone }: { trigger: TriggerDefinition; onDone: () => void }) {
  const revsQ = useQuery({
    queryKey: ["trigger-revisions", trigger.id],
    queryFn: () => listRevisions(trigger.id),
  });

  const restoreM = useMutation({
    mutationFn: (rev: TriggerRevision) => restoreRevision(trigger, rev),
    onSuccess: () => {
      toast.success("Versão restaurada (nova revisão gravada).");
      onDone();
      void revsQ.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revs = revsQ.data ?? [];

  return (
    <div className="mt-2 rounded-xl border border-border/60 bg-charcoal-950/40 p-3">
      <p className="font-display text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        versões
      </p>
      {revsQ.isLoading ? (
        <p className="mt-1 text-[11px] text-muted-foreground">carregando…</p>
      ) : revs.length === 0 ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          nenhuma versão anterior — este é o estado original
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {revs.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-[11px]">
              <span className="font-mono text-muted-foreground">v{r.revision}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {new Date(r.changed_at).toLocaleString("pt-BR")}
                {r.change_note ? ` · ${r.change_note}` : ""}
              </span>
              <button
                type="button"
                onClick={() => restoreM.mutate(r)}
                disabled={restoreM.isPending}
                className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground active:scale-95"
              >
                restaurar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MiniBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Play;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground active:scale-95"
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="mb-1.5 font-display text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {n}. {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-2 block text-[11px] text-muted-foreground">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-charcoal-950/30 px-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[hsl(var(--ember,20_90%_55%))]"
      />
      <span className="flex-1 text-[12px] text-foreground">{label}</span>
      {checked ? children : null}
    </div>
  );
}
