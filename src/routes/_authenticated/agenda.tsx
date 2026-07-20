import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Plus, Check, Sparkles, X, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import {
  listMissions,
  createMission,
  toggleMissionToday,
  maskToDays,
  toggleDay,
  formatMask,
  WEEKDAY_LABELS,
  WEEKDAY_FULL,
  type UserMissionWithMeta,
  type MissionType,
} from "@/lib/missions";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Weme" }] }),
  component: AgendaPage,
});

type View = "dia" | "semana" | "mes" | "ano";

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0]; // seg..dom (índices weekday, dom=0)
const DAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WEEK_HEAD = ["S", "T", "Q", "Q", "S", "S", "D"];
const WEEK_HEAD_FULL = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
/** Compromissos visíveis por dia na visão MÊS do desktop (no mobile é 1). */
const MONTH_MAX_EVENTS = 3;
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_FULL = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "--:--");
const mondayIdx = (jsDay: number) => (jsDay + 6) % 7;
// --- Grade de horários (visão semana) ---
const WEEK_START_HOUR = 6;
const WEEK_END_HOUR = 23;
const ROW_H = 46; // px por hora
const HOURS = Array.from(
  { length: WEEK_END_HOUR - WEEK_START_HOUR + 1 },
  (_, i) => WEEK_START_HOUR + i,
);
const GRID_H = (WEEK_END_HOUR - WEEK_START_HOUR + 1) * ROW_H;

function timeToOffset(t: string | null): number {
  if (!t) return 0;
  const [h, mn] = t.split(":").map(Number);
  const mins = (h - WEEK_START_HOUR) * 60 + mn;
  return Math.max(0, (mins / 60) * ROW_H);
}
function blockHeight(start: string | null, end: string | null): number {
  if (!start) return ROW_H * 0.6;
  const [sh, sm] = start.split(":").map(Number);
  let mins = 60;
  if (end) {
    const [eh, em] = end.split(":").map(Number);
    mins = eh * 60 + em - (sh * 60 + sm);
  }
  return Math.max(18, (mins / 60) * ROW_H - 2);
}

function DayTaskBox({
  m,
  userId,
  onChanged,
}: {
  m: UserMissionWithMeta;
  userId: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const done = m.done_today;
  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      await toggleMissionToday(m, userId);
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={
        "flex flex-col gap-2 rounded-xl border p-3 transition-colors " +
        (done ? "border-ember/50 bg-ember/10" : "border-border bg-charcoal-900")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <span className={"font-display text-sm " + (done ? "text-ember/70" : "text-ember")}>
          {hhmm(m.scheduled_time)}
          {m.end_time ? `–${hhmm(m.end_time)}` : ""}
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-label={done ? "Desmarcar tarefa" : "Concluir tarefa"}
          className={
            "forge-press grid h-7 w-7 shrink-0 place-items-center rounded-md border active:forge-press-active " +
            (done
              ? "border-ember bg-ember text-charcoal-900 ember-glow"
              : "border-border bg-charcoal-800 text-muted-foreground")
          }
        >
          {done && <Check className="h-4 w-4" strokeWidth={3} />}
        </button>
      </div>
      <p
        className={
          "text-sm leading-snug " +
          (done ? "text-muted-foreground line-through" : "text-foreground")
        }
      >
        {m.title}
      </p>
    </div>
  );
}

function CreatePanel({
  userId,
  defaultMask,
  onCreated,
  onClose,
}: {
  userId: string;
  defaultMask: number;
  onCreated: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("18:00");
  const [endTime, setEndTime] = useState("19:00");
  const [mask, setMask] = useState(defaultMask || 62);
  const [saving, setSaving] = useState(false);

  const endInvalid = Boolean(time && endTime && endTime <= time);

  async function save() {
    if (!title.trim() || saving || endInvalid) return;
    setSaving(true);
    const type: MissionType = mask === 127 ? "daily" : "weekly";
    try {
      await createMission(userId, {
        title,
        scheduled_time: time || null,
        end_time: endTime || null,
        weekday_mask: mask || 127,
        mission_type: type,
        xp_reward: 15,
      });
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="forge-card mx-4 mt-3 rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg tracking-wide text-foreground">Novo compromisso</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <label className="mb-1 block font-display text-[10px] tracking-[0.25em] text-muted-foreground">
        TÍTULO
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Ex.: Treino de força"
        className="mb-3 w-full rounded-xl border border-input bg-charcoal-900 px-3 py-2.5 text-foreground outline-none placeholder:text-muted-foreground focus:border-ember/60"
      />

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block font-display text-[10px] tracking-[0.25em] text-muted-foreground">
            INÍCIO
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-xl border border-input bg-charcoal-900 px-3 py-2.5 text-foreground outline-none focus:border-ember/60"
          />
        </div>
        <div>
          <label className="mb-1 block font-display text-[10px] tracking-[0.25em] text-muted-foreground">
            FIM
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={
              "w-full rounded-xl border bg-charcoal-900 px-3 py-2.5 text-foreground outline-none focus:border-ember/60 " +
              (endInvalid ? "border-destructive" : "border-input")
            }
          />
        </div>
      </div>
      {endInvalid && (
        <p className="mb-3 -mt-1 text-[11px] text-destructive">
          O fim precisa ser depois do início.
        </p>
      )}

      <label className="mb-1.5 block font-display text-[10px] tracking-[0.25em] text-muted-foreground">
        DIAS
      </label>
      <div className="mb-4 flex gap-1.5">
        {MON_FIRST.map((idx) => {
          const on = maskToDays(mask).includes(idx);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setMask((mk) => toggleDay(mk, idx))}
              className={
                "grid h-9 flex-1 place-items-center rounded-lg border font-display text-sm " +
                (on
                  ? "border-ember/40 bg-ember text-charcoal-900"
                  : "border-border bg-charcoal-900 text-muted-foreground")
              }
            >
              {WEEKDAY_LABELS[idx]}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={!title.trim() || saving || endInvalid}
        className="w-full rounded-xl bg-ember py-3 font-display text-base tracking-wide text-charcoal-900 active:scale-[0.99] disabled:opacity-50"
      >
        {saving ? "Salvando…" : "Agendar compromisso"}
      </button>
    </div>
  );
}

function AgendaPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [missions, setMissions] = useState<UserMissionWithMeta[]>([]);
  const [view, setView] = useState<View>("dia");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [showForm, setShowForm] = useState(false);

  const reload = useCallback(async (uid: string) => {
    try {
      setMissions(await listMissions(uid));
    } catch {
      setMissions([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || !active) return;
      setUserId(uid);
      await reload(uid);
    })();
    return () => {
      active = false;
    };
  }, [reload]);

  const today = new Date();

  // Missões recorrentes que caem num dia da semana (idx 0=dom..6=sáb)
  const onWeekday = (idx: number, forDate?: Date) =>
    missions
      .filter((m) => {
        if (m.mission_type === "one_off") return forDate ? sameDay(forDate, today) : false;
        return maskToDays(m.weekday_mask).includes(idx);
      })
      .sort((a, b) => (a.scheduled_time ?? "99").localeCompare(b.scheduled_time ?? "99"));

  // Navegação por período
  function shift(dir: 1 | -1) {
    const d = new Date(anchor);
    if (view === "dia") d.setDate(d.getDate() + dir);
    else if (view === "semana") d.setDate(d.getDate() + 7 * dir);
    else if (view === "mes") d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    setAnchor(d);
  }

  function periodLabel(): string {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    if (view === "dia") {
      return `${DAY_SHORT[anchor.getDay()]}, ${anchor.getDate()} ${MONTHS[m].toLowerCase()}`;
    }
    if (view === "semana") {
      const ws = new Date(anchor);
      ws.setDate(anchor.getDate() - mondayIdx(anchor.getDay()));
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      return `${ws.getDate()} ${MONTHS[ws.getMonth()].toLowerCase()} – ${we.getDate()} ${MONTHS[we.getMonth()].toLowerCase()}`;
    }
    if (view === "mes") return `${MONTHS_FULL[m]} ${y}`;
    return `${y}`;
  }

  const weekDays = (() => {
    const ws = new Date(anchor);
    ws.setDate(anchor.getDate() - mondayIdx(anchor.getDay()));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws);
      d.setDate(ws.getDate() + i);
      return d;
    });
  })();

  return (
    <MobileShell>
      <header
        className="sticky top-0 z-30 border-b border-border bg-charcoal-900/85 pb-3 pl-4 pr-4 pt-5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <h1 className="font-display text-2xl tracking-wide text-foreground">AGENDA</h1>
          <div className="flex rounded-xl border border-border bg-charcoal-900 p-0.5">
            {(["dia", "semana", "mes", "ano"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={
                  "rounded-lg px-2.5 py-1 font-display text-[10px] tracking-[0.15em] " +
                  (view === v ? "bg-ember text-charcoal-900" : "text-muted-foreground")
                }
              >
                {v === "dia" ? "DIA" : v === "semana" ? "SEM" : v === "mes" ? "MÊS" : "ANO"}
              </button>
            ))}
          </div>
        </div>

        {/* Navegação de período ‹ label › */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Anterior"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-charcoal-900 text-foreground active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="font-display text-sm tracking-[0.12em] text-foreground"
          >
            {periodLabel()}
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Próximo"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-charcoal-900 text-foreground active:scale-95"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </header>

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="forge-press mx-4 mt-4 flex w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-2xl border border-dashed border-ember/40 bg-charcoal-900 py-3 text-ember active:forge-press-active"
        >
          <Plus className="h-4 w-4" />
          <span className="font-display text-sm tracking-[0.15em]">CRIAR COMPROMISSO</span>
        </button>
      )}
      {showForm && userId && (
        <CreatePanel
          userId={userId}
          defaultMask={view === "dia" ? 1 << anchor.getDay() : 62}
          onClose={() => setShowForm(false)}
          onCreated={() => userId && reload(userId)}
        />
      )}

      {/* ---- DIA ---- */}
      {view === "dia" && (
        <section className="px-4 pt-4">
          {(() => {
            const items = onWeekday(anchor.getDay(), anchor).slice(0, 10);
            const totalDone = items.filter((m) => m.done_today).length;
            return items.length === 0 ? (
              <div className="forge-card rounded-2xl px-4 py-8 text-center text-muted-foreground">
                Nada agendado para {sameDay(anchor, today) ? "hoje" : "este dia"}.
              </div>
            ) : (
              <div className="forge-card rounded-2xl p-3">
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
                    PRINCIPAIS TAREFAS
                  </p>
                  <span className="font-display text-[11px] text-ember">
                    {totalDone}/{items.length}
                  </span>
                </div>
                <div
                  className="grid grid-cols-2 gap-2 overflow-y-auto pr-0.5 lg:grid-cols-3"
                  style={{ maxHeight: "60vh" }}
                >
                  {items.map((m) => (
                    <DayTaskBox
                      key={m.id}
                      m={m}
                      userId={userId!}
                      onChanged={() => userId && reload(userId)}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* ---- SEMANA (grade de horários) ---- */}
      {view === "semana" && (
        <section className="px-4 pt-4">
          <div className="forge-card rounded-2xl p-2">
            {/* Cabeçalho fixo com os dias */}
            <div className="mb-1 flex border-b border-border/50 pb-1">
              <div className="w-9 shrink-0 lg:w-12" />
              {weekDays.map((d, i) => {
                const isToday = sameDay(d, today);
                return (
                  <div key={i} className="flex-1 text-center">
                    <div
                      className={
                        "font-display text-[9px] tracking-[0.15em] lg:text-[11px] " +
                        (isToday ? "text-ember" : "text-muted-foreground")
                      }
                    >
                      {DAY_SHORT[d.getDay()].toUpperCase()}
                    </div>
                    <div
                      className={
                        "mx-auto mt-0.5 grid h-6 w-6 place-items-center rounded-full font-display text-xs lg:h-7 lg:w-7 lg:text-sm " +
                        (isToday ? "bg-ember text-charcoal-900" : "text-foreground/80")
                      }
                    >
                      {d.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Corpo com scroll vertical interno */}
            <div className="overflow-y-auto" style={{ maxHeight: "62vh" }}>
              <div className="relative flex" style={{ height: GRID_H }}>
                {/* Coluna de horários */}
                <div className="w-9 shrink-0 lg:w-12">
                  {HOURS.map((h) => (
                    <div key={h} className="relative" style={{ height: ROW_H }}>
                      <span className="absolute -top-1.5 right-1 font-display text-[9px] text-muted-foreground lg:text-[11px]">
                        {h}h
                      </span>
                    </div>
                  ))}
                </div>

                {/* Colunas dos dias */}
                {weekDays.map((d, i) => {
                  const dayMissions = onWeekday(d.getDay(), d).filter((m) => m.scheduled_time);
                  const isToday = sameDay(d, today);
                  return (
                    <div
                      key={i}
                      className={
                        "relative flex-1 border-l border-border/40 " +
                        (isToday ? "bg-ember/[0.04]" : "")
                      }
                    >
                      {/* Linhas de hora */}
                      {HOURS.map((h) => (
                        <div
                          key={h}
                          className="border-t border-border/25"
                          style={{ height: ROW_H }}
                        />
                      ))}
                      {/* Blocos de tarefa */}
                      {dayMissions.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setAnchor(d);
                            setView("dia");
                          }}
                          className={
                            "absolute left-0.5 right-0.5 overflow-hidden rounded-md px-1 py-0.5 text-left active:scale-[0.98] " +
                            (m.done_today
                              ? "bg-ember/40 text-charcoal-900"
                              : "bg-ember/85 text-charcoal-900")
                          }
                          style={{
                            top: timeToOffset(m.scheduled_time),
                            height: blockHeight(m.scheduled_time, m.end_time ?? null),
                          }}
                        >
                          <span className="block font-display text-[8px] leading-tight lg:text-[11px]">
                            {hhmm(m.scheduled_time)}
                          </span>
                          <span
                            className={
                              "block truncate text-[8px] leading-tight lg:text-[11px] " +
                              (m.done_today ? "line-through" : "")
                            }
                          >
                            {m.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Toque numa tarefa para abrir o dia. Compromissos sem horário não aparecem na grade.
          </p>
        </section>
      )}

      {/* ---- MÊS ---- */}
      {view === "mes" && (
        <section className="px-4 pt-4">
          <div className="forge-card rounded-2xl p-3">
            <div className="mb-1 grid grid-cols-7 gap-1 lg:gap-1.5">
              {WEEK_HEAD.map((d, i) => (
                <span
                  key={i}
                  className="text-center font-display text-[10px] tracking-widest text-muted-foreground lg:text-left lg:text-[11px] lg:tracking-[0.2em]"
                >
                  {/* "S T Q Q S S D" é ambíguo; no desktop cabe o nome curto,
                      alinhado à esquerda igual ao número do dia na célula. */}
                  <span className="lg:hidden">{d}</span>
                  <span className="hidden lg:inline">{WEEK_HEAD_FULL[i]}</span>
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 lg:gap-1.5">
              {(() => {
                const y = anchor.getFullYear();
                const m = anchor.getMonth();
                const firstOffset = mondayIdx(new Date(y, m, 1).getDay());
                const daysInMonth = new Date(y, m + 1, 0).getDate();
                const cells: (number | null)[] = [
                  ...Array(firstOffset).fill(null),
                  ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
                ];
                return cells.map((day, i) => {
                  if (day === null) return <span key={i} />;
                  const date = new Date(y, m, day);
                  const dayMs = onWeekday(date.getDay());
                  const isToday = sameDay(date, today);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setAnchor(date);
                        setView("dia");
                      }}
                      className={
                        "flex min-h-[52px] flex-col rounded-lg p-1 text-left lg:min-h-[124px] lg:gap-0.5 lg:p-2 " +
                        (isToday
                          ? "bg-ember text-charcoal-900"
                          : "bg-charcoal-800/40 text-foreground/80 active:bg-charcoal-800")
                      }
                    >
                      <span className="font-display text-[11px] leading-none lg:text-base">
                        {day}
                      </span>

                      {/* Mobile mostra 1 compromisso; desktop mostra até 3 —
                          cabe, e "+7 mais" escondia o mês inteiro atrás de um
                          contador. Cada um vira uma pastilha com hora em cima
                          do título, que assim não trunca no meio da palavra. */}
                      {dayMs.slice(0, MONTH_MAX_EVENTS).map((ms, k) => (
                        <span
                          key={ms.id}
                          className={
                            "mt-0.5 min-w-0 rounded px-1 py-0.5 text-[7px] leading-tight lg:mt-0 lg:px-1.5 lg:py-1 lg:text-[10px] " +
                            (k > 0 ? "hidden lg:block " : "") +
                            (isToday
                              ? "bg-charcoal-900/15 text-charcoal-900"
                              : "bg-ember/12 text-ember")
                          }
                        >
                          <span className="hidden font-display tabular-nums lg:block">
                            {hhmm(ms.scheduled_time)}
                          </span>
                          <span className="block truncate">
                            <span className="lg:hidden">{hhmm(ms.scheduled_time)} </span>
                            {ms.title}
                          </span>
                        </span>
                      ))}

                      {/* O contador difere por viewport porque o nº visível difere. */}
                      {dayMs.length > 1 && (
                        <span
                          className={
                            "mt-auto truncate pt-0.5 text-[7px] leading-tight lg:hidden " +
                            (isToday ? "text-charcoal-900/70" : "text-muted-foreground")
                          }
                        >
                          +{dayMs.length - 1} mais
                        </span>
                      )}
                      {dayMs.length > MONTH_MAX_EVENTS && (
                        <span
                          className={
                            "mt-auto hidden truncate pt-0.5 text-[10px] leading-tight lg:block " +
                            (isToday ? "text-charcoal-900/70" : "text-muted-foreground")
                          }
                        >
                          +{dayMs.length - MONTH_MAX_EVENTS} mais
                        </span>
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Toque num dia para ver os compromissos.
          </p>
        </section>
      )}

      {/* ---- ANO ---- */}
      {view === "ano" && (
        <section className="px-4 pt-4">
          <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {MONTHS.map((mn, mi) => {
              const isThis =
                mi === today.getMonth() && anchor.getFullYear() === today.getFullYear();
              return (
                <button
                  key={mi}
                  type="button"
                  onClick={() => {
                    const d = new Date(anchor);
                    d.setMonth(mi);
                    d.setDate(1);
                    setAnchor(d);
                    setView("mes");
                  }}
                  className={
                    "forge-card flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl active:forge-press-active lg:aspect-[3/2] " +
                    (isThis ? "border-ember/50" : "")
                  }
                >
                  <span className="font-display text-lg tracking-wide text-foreground">{mn}</span>
                  {isThis && (
                    <span className="font-display text-[9px] tracking-[0.2em] text-ember">
                      ATUAL
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <Link
        to="/assistente"
        className="forge-card mx-4 mb-8 mt-5 flex items-center gap-3 rounded-2xl p-3.5 active:forge-press-active"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-charcoal-900 text-ember">
          <Sparkles className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <span className="flex-1">
          <span className="block font-display text-base tracking-wide text-foreground">
            Pedir para a IA
          </span>
          <span className="block text-[11px] text-muted-foreground">
            “agende treino seg e qua às 18h”
          </span>
        </span>
      </Link>

      <div className="h-24" />
    </MobileShell>
  );
}
