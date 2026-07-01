import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Target, CalendarDays, Sparkles, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import { AREAS } from "@/components/map/areas";
import {
  calendarActivity,
  createGoal,
  createScheduled,
  currentQuarter,
  dateKey,
  deleteGoal,
  deleteScheduled,
  listGoals,
  listScheduled,
  monthMatrix,
  quarterRange,
  updateGoal,
  updateScheduledStatus,
  type CalendarDay,
  type ScheduledQuest,
  type StrategicGoal,
} from "@/lib/planning";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário — Personal IA" },
      { name: "description", content: "Planeje quests futuras, acompanhe metas trimestrais e veja seu heatmap de constância." },
    ],
  }),
  component: CalendarioPage,
});

type Tab = "month" | "agenda" | "goals";

function CalendarioPage() {
  const [tab, setTab] = useState<Tab>("month");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  return (
    <MobileShell>
      <header className="px-4 pt-6 pb-3">
        <p className="font-display text-[10px] tracking-[0.3em] text-ember">PLANEJAMENTO</p>
        <h1 className="font-display text-3xl tracking-[0.12em] text-foreground">CALENDÁRIO</h1>
        <p className="mt-1 font-body text-sm text-muted-foreground">
          Heatmap de constância, agenda de missões futuras e metas trimestrais.
        </p>
      </header>

      <div className="mx-4 mb-4 grid grid-cols-3 gap-1 rounded-2xl border border-border bg-charcoal-900 p-1">
        {[
          { id: "month" as const, label: "MÊS", icon: CalendarDays },
          { id: "agenda" as const, label: "AGENDA", icon: Sparkles },
          { id: "goals" as const, label: "METAS", icon: Target },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 font-display text-[11px] tracking-[0.2em] transition-colors ${
                active ? "bg-ember/15 text-ember" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
              {t.label}
            </button>
          );
        })}
      </div>

      {userId && (
        <>
          {tab === "month" && <MonthView userId={userId} />}
          {tab === "agenda" && <AgendaView userId={userId} />}
          {tab === "goals" && <GoalsView userId={userId} />}
        </>
      )}

      <div className="h-24" />
    </MobileShell>
  );
}

// ============ MONTH HEATMAP ============

function MonthView({ userId }: { userId: string }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [activity, setActivity] = useState<Record<string, CalendarDay>>({});
  const [scheduled, setScheduled] = useState<Record<string, ScheduledQuest[]>>({});
  const [selected, setSelected] = useState<string | null>(null);

  const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const start = weeks[0][0];
  const end = weeks[weeks.length - 1][6];

  const load = useCallback(async () => {
    try {
      const [act, sched] = await Promise.all([
        calendarActivity(start, end),
        listScheduled(userId, start, end),
      ]);
      setActivity(Object.fromEntries(act.map((d) => [d.day, d])));
      const grouped: Record<string, ScheduledQuest[]> = {};
      for (const s of sched) {
        (grouped[s.scheduled_date] ??= []).push(s);
      }
      setScheduled(grouped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao carregar calendário");
    }
  }, [userId, start, end]);

  useEffect(() => { load(); }, [load]);

  const monthName = new Date(cursor.year, cursor.month, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  function shift(delta: number) {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }

  function intensity(xp: number): string {
    if (xp <= 0) return "bg-charcoal-800";
    if (xp < 50) return "bg-ember/20";
    if (xp < 150) return "bg-ember/40";
    if (xp < 300) return "bg-ember/60";
    return "bg-ember/90";
  }

  const todayKey = dateKey(new Date());
  const selectedQuests = selected ? scheduled[selected] ?? [] : [];
  const selectedAct = selected ? activity[selected] : undefined;

  return (
    <section className="px-4">
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-2">
        <button onClick={() => shift(-1)} className="rounded-lg p-2 text-muted-foreground active:bg-charcoal-800">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-display text-sm tracking-[0.2em] text-foreground uppercase">{monthName}</p>
        <button onClick={() => shift(1)} className="rounded-lg p-2 text-muted-foreground active:bg-charcoal-800">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 px-1 pb-1">
        {["S","T","Q","Q","S","S","D"].map((d, i) => (
          <div key={i} className="text-center font-display text-[9px] tracking-[0.2em] text-muted-foreground">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((d) => {
          const key = dateKey(d);
          const inMonth = d.getMonth() === cursor.month;
          const act = activity[key];
          const xp = act?.xp ?? 0;
          const planned = (scheduled[key] ?? []).length;
          const isToday = key === todayKey;
          const isSel = selected === key;
          return (
            <button
              key={key}
              onClick={() => setSelected(isSel ? null : key)}
              className={`relative aspect-square rounded-lg text-[10px] font-display tracking-wider transition-all ${intensity(xp)} ${
                !inMonth ? "opacity-30" : ""
              } ${isSel ? "ring-2 ring-ember" : isToday ? "ring-1 ring-foreground/60" : ""}`}
            >
              <span className={xp > 200 ? "text-charcoal-900" : "text-foreground/80"}>{d.getDate()}</span>
              {planned > 0 && (
                <span className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-ember-glow" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-charcoal-900/50 px-3 py-2">
        <span className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">MENOS</span>
        <div className="flex gap-1">
          {["bg-charcoal-800", "bg-ember/20", "bg-ember/40", "bg-ember/60", "bg-ember/90"].map((c, i) => (
            <span key={i} className={`h-3 w-3 rounded ${c}`} />
          ))}
        </div>
        <span className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">MAIS</span>
      </div>

      {selected && (
        <div className="mt-4 rounded-2xl border border-ember/30 bg-card p-4">
          <p className="font-display text-[10px] tracking-[0.3em] text-ember">
            {new Date(selected).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
          <p className="mt-1 font-display text-2xl tracking-wide text-foreground">
            {selectedAct?.xp ?? 0} XP · {selectedAct?.events ?? 0} eventos
          </p>
          {selectedQuests.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {selectedQuests.map((q) => (
                <li key={q.id} className="rounded-lg border border-border bg-charcoal-900 px-3 py-2">
                  <p className="font-display text-sm tracking-wide text-foreground">{q.title}</p>
                  {q.subtitle && <p className="font-body text-xs text-muted-foreground">{q.subtitle}</p>}
                  <p className="mt-1 font-display text-[10px] tracking-[0.25em] text-ember">
                    {q.status.toUpperCase()} · +{q.xp_reward} XP
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 font-body text-xs text-muted-foreground">
              Nada agendado. Use a aba AGENDA para planejar uma missão.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ============ AGENDA ============

function AgendaView({ userId }: { userId: string }) {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate());
  const [items, setItems] = useState<ScheduledQuest[]>([]);
  const [form, setForm] = useState({ title: "", subtitle: "", date: dateKey(today), area_slug: "", xp_reward: 50 });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listScheduled(userId, today, end);
      setItems(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao listar agenda");
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.title.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createScheduled({
        user_id: userId,
        scheduled_date: form.date,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        area_slug: form.area_slug || null,
        xp_reward: form.xp_reward,
      });
      setForm({ ...form, title: "", subtitle: "" });
      await load();
      toast.success("Missão agendada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao agendar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatus(q: ScheduledQuest, status: ScheduledQuest["status"]) {
    try {
      await updateScheduledStatus(q.id, status);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteScheduled(id);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao apagar");
    }
  }

  return (
    <section className="px-4 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="font-display text-[10px] tracking-[0.3em] text-ember mb-2">NOVA MISSÃO AGENDADA</p>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Título da missão"
          className="w-full rounded-lg border border-border bg-charcoal-900 px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/60"
        />
        <input
          value={form.subtitle}
          onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
          placeholder="Subtítulo (opcional)"
          className="mt-2 w-full rounded-lg border border-border bg-charcoal-900 px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/60"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="rounded-lg border border-border bg-charcoal-900 px-3 py-2 font-body text-sm text-foreground"
          />
          <select
            value={form.area_slug}
            onChange={(e) => setForm({ ...form, area_slug: e.target.value })}
            className="rounded-lg border border-border bg-charcoal-900 px-3 py-2 font-body text-sm text-foreground"
          >
            <option value="">Sem área</option>
            {AREAS.map((a) => (
              <option key={a.slug} value={a.slug}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <label className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">XP</label>
          <input
            type="number"
            min={10}
            max={500}
            step={5}
            value={form.xp_reward}
            onChange={(e) => setForm({ ...form, xp_reward: Number(e.target.value) })}
            className="w-20 rounded-lg border border-border bg-charcoal-900 px-2 py-1 font-body text-sm text-foreground"
          />
          <button
            onClick={handleCreate}
            disabled={submitting || !form.title.trim()}
            className="ml-auto flex items-center gap-1 rounded-lg bg-ember px-3 py-2 font-display text-[11px] tracking-[0.2em] text-charcoal-900 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> AGENDAR
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center font-body text-sm text-muted-foreground">
          Nenhuma missão agendada nos próximos 60 dias.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((q) => {
            const d = new Date(q.scheduled_date + "T00:00:00");
            const isPast = d < new Date(new Date().toDateString());
            return (
              <li key={q.id} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-[10px] tracking-[0.25em] text-ember">
                      {d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).toUpperCase()}
                      {" · +"}{q.xp_reward} XP
                      {q.status !== "planned" && ` · ${q.status.toUpperCase()}`}
                    </p>
                    <p className="font-display text-base tracking-wide text-foreground">{q.title}</p>
                    {q.subtitle && <p className="font-body text-xs text-muted-foreground">{q.subtitle}</p>}
                  </div>
                  <button onClick={() => handleDelete(q.id)} className="text-muted-foreground active:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {q.status === "planned" && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleStatus(q, "done")}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-ember/40 bg-ember/10 px-2 py-1.5 font-display text-[10px] tracking-[0.2em] text-ember"
                    >
                      <Check className="h-3 w-3" /> FEITA
                    </button>
                    {isPast && (
                      <button
                        onClick={() => handleStatus(q, "skipped")}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-charcoal-900 px-2 py-1.5 font-display text-[10px] tracking-[0.2em] text-muted-foreground"
                      >
                        <X className="h-3 w-3" /> PULAR
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ============ GOALS ============

function GoalsView({ userId }: { userId: string }) {
  const [quarter, setQuarter] = useState(currentQuarter());
  const [goals, setGoals] = useState<StrategicGoal[]>([]);
  const [form, setForm] = useState({ title: "", description: "", area_slug: "", target_value: 1 });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listGoals(userId, quarter);
      setGoals(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao listar metas");
    }
  }, [userId, quarter]);

  useEffect(() => { load(); }, [load]);

  const range = quarterRange(quarter);

  async function handleCreate() {
    if (!form.title.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createGoal({
        user_id: userId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        area_slug: form.area_slug || null,
        quarter,
        target_value: form.target_value,
      });
      setForm({ title: "", description: "", area_slug: "", target_value: 1 });
      await load();
      toast.success("Meta criada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar");
    } finally {
      setSubmitting(false);
    }
  }

  async function bumpProgress(g: StrategicGoal, delta: number) {
    const next = Math.max(0, g.current_value + delta);
    const target = g.target_value ?? 1;
    const completing = next >= target && g.status !== "completed";
    try {
      await updateGoal(g.id, {
        current_value: next,
        status: completing ? "completed" : g.status,
      });
      await load();
      if (completing) toast.success("Meta conquistada!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar");
    }
  }

  async function abandon(g: StrategicGoal) {
    try {
      await updateGoal(g.id, { status: "abandoned" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha");
    }
  }

  async function removeGoal(id: string) {
    try {
      await deleteGoal(id);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao apagar");
    }
  }

  function shiftQuarter(delta: number) {
    const [y, q] = quarter.split("-Q").map(Number);
    let nq = q + delta;
    let ny = y;
    if (nq > 4) { nq = 1; ny++; }
    if (nq < 1) { nq = 4; ny--; }
    setQuarter(`${ny}-Q${nq}`);
  }

  return (
    <section className="px-4 space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-2">
        <button onClick={() => shiftQuarter(-1)} className="rounded-lg p-2 text-muted-foreground active:bg-charcoal-800">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="font-display text-base tracking-[0.2em] text-foreground">{quarter}</p>
          <p className="font-display text-[9px] tracking-[0.3em] text-muted-foreground">
            {range.start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} → {range.end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </p>
        </div>
        <button onClick={() => shiftQuarter(1)} className="rounded-lg p-2 text-muted-foreground active:bg-charcoal-800">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="font-display text-[10px] tracking-[0.3em] text-ember mb-2">NOVA META TRIMESTRAL</p>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Ex: Treinar 36 vezes neste trimestre"
          className="w-full rounded-lg border border-border bg-charcoal-900 px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/60"
        />
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Como você vai chegar lá? (opcional)"
          rows={2}
          className="mt-2 w-full rounded-lg border border-border bg-charcoal-900 px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground/60"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select
            value={form.area_slug}
            onChange={(e) => setForm({ ...form, area_slug: e.target.value })}
            className="rounded-lg border border-border bg-charcoal-900 px-3 py-2 font-body text-sm text-foreground"
          >
            <option value="">Sem área</option>
            {AREAS.map((a) => (
              <option key={a.slug} value={a.slug}>{a.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-charcoal-900 px-3 py-2">
            <label className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">META</label>
            <input
              type="number"
              min={1}
              max={999}
              value={form.target_value}
              onChange={(e) => setForm({ ...form, target_value: Number(e.target.value) })}
              className="w-full bg-transparent font-body text-sm text-foreground outline-none"
            />
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={submitting || !form.title.trim()}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-ember px-3 py-2 font-display text-[11px] tracking-[0.2em] text-charcoal-900 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> CRIAR META
        </button>
      </div>

      {goals.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center font-body text-sm text-muted-foreground">
          Nenhuma meta para {quarter}. Defina o que importa nos próximos 90 dias.
        </p>
      ) : (
        <ul className="space-y-2">
          {goals.map((g) => {
            const target = g.target_value ?? 1;
            const pct = Math.min(100, Math.round((g.current_value / target) * 100));
            const area = AREAS.find((a) => a.slug === g.area_slug);
            return (
              <li key={g.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-display text-[10px] tracking-[0.25em] text-ember">
                      {g.status.toUpperCase()}{area ? ` · ${area.name.toUpperCase()}` : ""}
                    </p>
                    <p className="font-display text-base tracking-wide text-foreground">{g.title}</p>
                    {g.description && <p className="mt-0.5 font-body text-xs text-muted-foreground">{g.description}</p>}
                  </div>
                  <button onClick={() => removeGoal(g.id)} className="text-muted-foreground active:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-2xl tracking-wide text-foreground">{g.current_value}<span className="text-muted-foreground text-sm">/{target}</span></span>
                    <span className="font-display text-[10px] tracking-[0.3em] text-ember">{pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-charcoal-800">
                    <div className="h-full bg-ember transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {g.status === "active" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => bumpProgress(g, -1)}
                      className="rounded-lg border border-border bg-charcoal-900 px-3 py-1.5 font-display text-sm text-muted-foreground"
                    >−</button>
                    <button
                      onClick={() => bumpProgress(g, 1)}
                      className="flex-1 rounded-lg bg-ember/15 px-3 py-1.5 font-display text-[11px] tracking-[0.2em] text-ember"
                    >+1 PROGRESSO</button>
                    <button
                      onClick={() => abandon(g)}
                      className="rounded-lg border border-border bg-charcoal-900 px-3 py-1.5 font-display text-[10px] tracking-[0.2em] text-muted-foreground"
                    >X</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
