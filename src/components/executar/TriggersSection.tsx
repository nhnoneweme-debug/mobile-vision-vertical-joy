// Seção "Gatilhos" do Executando — lista sequencial, formulário direto e
// histórico de disparos. A avaliação em tempo real acontece no painel Live.

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_COOLDOWN,
  createTrigger,
  deleteTrigger,
  describeAction,
  describeCondition,
  listFirings,
  listTriggers,
  reorderTriggers,
  seedExampleTriggers,
  updateTrigger,
  type TriggerAction,
  type TriggerCondition,
  type TriggerDefinition,
  type TriggerDraft,
} from "@/lib/triggers";

type CondKind =
  | "at_time"
  | "every"
  | "after_session"
  | "audio"
  | "motion_spike"
  | "motion_angle"
  | "video";

const COND_LABEL: Record<CondKind, string> = {
  at_time: "Cronos · hora do dia",
  every: "Cronos · a cada X min de Live",
  after_session: "Cronos · após X min de sessão",
  audio: "Evento · palavra-chave no áudio",
  motion_spike: "Evento · movimento brusco",
  motion_angle: "Evento · mudança de ângulo",
  video: "Evento · vídeo (em breve)",
};

type FormState = {
  name: string;
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
};

const EMPTY_FORM: FormState = {
  name: "",
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
};

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
  if (f.message.trim()) a.message = f.message.trim();
  return a;
}

export function TriggersSection() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [open, setOpen] = useState(false);

  const triggersQ = useQuery({ queryKey: ["triggers"], queryFn: listTriggers });
  const firingsQ = useQuery({ queryKey: ["trigger-firings"], queryFn: () => listFirings(25) });

  const triggers = useMemo(
    () => [...(triggersQ.data ?? [])].sort((a, b) => a.position - b.position),
    [triggersQ.data],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of firingsQ.data ?? []) {
      if (f.result === "executed") map[f.trigger_id] = (map[f.trigger_id] ?? 0) + 1;
    }
    return map;
  }, [firingsQ.data]);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["triggers"] });
    void qc.invalidateQueries({ queryKey: ["trigger-firings"] });
  }, [qc]);

  const createM = useMutation({
    mutationFn: (draft: TriggerDraft) => createTrigger(draft, triggers.length),
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setOpen(false);
      invalidate();
      toast.success("Gatilho criado.");
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

  const seedM = useMutation({
    mutationFn: () => seedExampleTriggers(triggers),
    onSuccess: (did) => {
      invalidate();
      if (did) toast.success("Dois gatilhos de exemplo criados (desligados).");
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <Zap className="h-3.5 w-3.5" /> Lista sequencial
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Avaliados na ordem, de cima pra baixo, enquanto o painel Live está aberto.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-ember/40 bg-ember/10 px-3 py-2 text-xs text-ember active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> Novo
          </button>
        </div>

        {triggersQ.isLoading ? (
          <p className="mt-3 text-[12px] text-muted-foreground">carregando…</p>
        ) : triggers.length === 0 ? (
          <div className="mt-3 rounded-xl border border-border/60 bg-charcoal-950/40 p-3">
            <p className="text-[12px] text-muted-foreground">
              Nenhum gatilho ainda. Posso criar dois exemplos desligados pra você ver o formato.
            </p>
            <button
              type="button"
              onClick={() => seedM.mutate()}
              disabled={seedM.isPending}
              className="mt-2 rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground active:scale-95"
            >
              Criar exemplos
            </button>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {triggers.map((t, i) => (
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
                      {describeCondition(t)} → {describeAction(t)}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      cooldown {t.cooldown_seconds}s · {counts[t.id] ?? 0} disparo(s) recentes
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
              </li>
            ))}
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
            Novo gatilho
          </h3>

          <label className="mt-3 block text-[11px] text-muted-foreground">
            nome
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="ex.: código off"
              className="mt-1 w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground outline-none"
            />
          </label>

          <label className="mt-3 block text-[11px] text-muted-foreground">
            condição
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as CondKind })}
              className="mt-1 w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground outline-none"
            >
              {(Object.keys(COND_LABEL) as CondKind[]).map((k) => (
                <option key={k} value={k} disabled={k === "video"}>
                  {COND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>

          {form.kind === "at_time" ? (
            <label className="mt-2 block text-[11px] text-muted-foreground">
              hora
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground"
              />
            </label>
          ) : null}

          {form.kind === "every" || form.kind === "after_session" ? (
            <label className="mt-2 block text-[11px] text-muted-foreground">
              minutos
              <input
                type="number"
                min={1}
                max={600}
                value={form.minutes}
                onChange={(e) => setForm({ ...form, minutes: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground"
              />
            </label>
          ) : null}

          {form.kind === "audio" ? (
            <label className="mt-2 block text-[11px] text-muted-foreground">
              palavra ou frase (sem diferenciar maiúsculas/acentos, nos 3 idiomas)
              <input
                value={form.keyword}
                onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                placeholder="ex.: código off"
                className="mt-1 w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground"
              />
            </label>
          ) : null}

          {form.kind === "motion_spike" ? (
            <label className="mt-2 block text-[11px] text-muted-foreground">
              magnitude mínima (m/s²)
              <input
                type="number"
                min={1}
                max={40}
                value={form.magnitude}
                onChange={(e) => setForm({ ...form, magnitude: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground"
              />
            </label>
          ) : null}

          {form.kind === "motion_angle" ? (
            <label className="mt-2 block text-[11px] text-muted-foreground">
              variação mínima de ângulo (graus)
              <input
                type="number"
                min={5}
                max={180}
                value={form.degrees}
                onChange={(e) => setForm({ ...form, degrees: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground"
              />
            </label>
          ) : null}

          <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">ação</p>
          <div className="mt-2 space-y-2">
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
          </div>

          <label className="mt-3 block text-[11px] text-muted-foreground">
            mensagem (opcional)
            <input
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground"
            />
          </label>

          <label className="mt-3 block text-[11px] text-muted-foreground">
            cooldown (segundos)
            <input
              type="number"
              min={0}
              max={3600}
              value={form.cooldown}
              onChange={(e) => setForm({ ...form, cooldown: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground"
            />
          </label>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={!form.name.trim() || createM.isPending}
              onClick={() =>
                createM.mutate({
                  name: form.name.trim(),
                  enabled: true,
                  trigger_type:
                    form.kind === "at_time" ||
                    form.kind === "every" ||
                    form.kind === "after_session"
                      ? "chronos"
                      : "event",
                  condition: buildCondition(form),
                  action: buildAction(form),
                  cooldown_seconds: form.cooldown,
                })
              }
              className="flex-1 rounded-xl border border-ember/40 bg-ember/10 py-2.5 text-sm text-ember disabled:opacity-40 active:scale-95"
            >
              Salvar gatilho
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
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
            {(firingsQ.data ?? []).map((f) => (
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
                      : f.result === "failed"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-charcoal-800 text-muted-foreground"
                  }`}
                >
                  {f.result === "executed"
                    ? "executado"
                    : f.result === "failed"
                      ? "falhou"
                      : "cooldown"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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
