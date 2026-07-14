import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dumbbell, Check, Sparkles, Plus, Minus, Trash2, Play, Pause, Square, Pencil, X, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/shell/MobileShell";
import {
  listWorkoutPlans, createWorkoutPlan, updateWorkoutPlan, deleteWorkoutPlan,
  listWorkoutSessions, createWorkoutSession, getTodayProgress, logSerie, undoSerie,
  type WorkoutPlan, type WorkoutDay, type WorkoutSession,
} from "@/lib/workouts.functions";
import { PostWorkoutCheckinSheet } from "@/components/circulo/PostWorkoutCheckinSheet";

export const Route = createFileRoute("/_authenticated/treino")({
  head: () => ({ meta: [{ title: "Treino — Personal IA" }] }),
  component: TreinoPage,
});

const ACTIVE_KEY = "treino.activePlanId";
const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
const targetOf = (s?: number) => (s && s > 0 ? s : 1);
function fmtDur(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Prog = Record<string, { done: boolean; series: number; weights: number[] }>;

function TreinoPage() {
  const fnList = useServerFn(listWorkoutPlans);
  const fnCreate = useServerFn(createWorkoutPlan);
  const fnUpdate = useServerFn(updateWorkoutPlan);
  const fnDelete = useServerFn(deleteWorkoutPlan);
  const fnSessions = useServerFn(listWorkoutSessions);
  const fnCreateSession = useServerFn(createWorkoutSession);
  const fnGetProgress = useServerFn(getTodayProgress);
  const fnLogSerie = useServerFn(logSerie);
  const fnUndoSerie = useServerFn(undoSerie);

  const [plans, setPlans] = useState<WorkoutPlan[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [prog, setProg] = useState<Prog>({});
  const [editing, setEditing] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");

  // Cronômetro (com pausa).
  const [active, setActive] = useState(false);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [accum, setAccum] = useState(0);
  const [now, setNow] = useState(Date.now());

  // Modais.
  const [weightModal, setWeightModal] = useState<{ exId: string; exName: string; target: number } | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [finishOpen, setFinishOpen] = useState(false);

  const activePlan = plans?.find((p) => p.id === activeId) ?? null;
  const activeDay: WorkoutDay | null = activePlan?.days[dayIdx] ?? null;

  useEffect(() => {
    (async () => {
      try {
        const pl = await fnList();
        setPlans(pl);
        let saved: string | null = null;
        try { saved = localStorage.getItem(ACTIVE_KEY); } catch { /* noop */ }
        setActiveId(pl.find((p) => p.id === saved)?.id ?? pl[0]?.id ?? null);
      } catch {
        setPlans([]);
        toast.error("Não consegui carregar seus treinos.");
      }
    })();
  }, [fnList]);

  useEffect(() => {
    if (!activeId) return;
    try { localStorage.setItem(ACTIVE_KEY, activeId); } catch { /* noop */ }
    setDayIdx(0);
    (async () => {
      try { setSessions(await fnSessions({ data: { planId: activeId } })); } catch { /* noop */ }
    })();
  }, [activeId, fnSessions]);

  const loadProgress = useCallback(async () => {
    if (!activePlan || !activeDay) { setProg({}); return; }
    try {
      const rows = await fnGetProgress({ data: { planId: activePlan.id, dayKey: activeDay.id } });
      const map: Prog = {};
      for (const r of rows) map[r.exercise_key] = { done: r.done, series: r.series, weights: r.weights ?? [] };
      setProg(map);
    } catch { setProg({}); }
  }, [activePlan, activeDay, fnGetProgress]);
  useEffect(() => { loadProgress(); }, [loadProgress]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const elapsed = Math.floor(accum + (running && startedAt ? (now - startedAt) / 1000 : 0));

  function startTimer() { setActive(true); setRunning(true); setStartedAt(Date.now()); setAccum(0); setNow(Date.now()); }
  function pauseTimer() {
    if (startedAt) setAccum((a) => a + (Date.now() - startedAt) / 1000);
    setRunning(false); setStartedAt(null);
  }
  function resumeTimer() { setRunning(true); setStartedAt(Date.now()); setNow(Date.now()); }

  function replacePlan(updated: WorkoutPlan) {
    setPlans((prev) => (prev ? prev.map((p) => (p.id === updated.id ? updated : p)) : prev));
  }
  async function saveDays(days: WorkoutDay[]) {
    if (!activePlan) return;
    try { replacePlan(await fnUpdate({ data: { id: activePlan.id, days } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar."); }
  }

  async function handleCreatePlan() {
    const name = newPlanName.trim();
    if (!name) return;
    try {
      const plan = await fnCreate({ data: { name } });
      setPlans((prev) => [plan, ...(prev ?? [])]);
      setActiveId(plan.id);
      setNewPlanName("");
      setEditing(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao criar treino."); }
  }
  async function handleDeletePlan() {
    if (!activePlan) return;
    if (!confirm(`Excluir o treino "${activePlan.name}"?`)) return;
    try {
      await fnDelete({ data: { id: activePlan.id } });
      const rest = (plans ?? []).filter((p) => p.id !== activePlan.id);
      setPlans(rest);
      setActiveId(rest[0]?.id ?? null);
      setEditing(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao excluir."); }
  }
  async function handleRename(name: string) {
    if (!activePlan) return;
    try { replacePlan(await fnUpdate({ data: { id: activePlan.id, name } })); } catch { /* noop */ }
  }
  function addDay() {
    if (!activePlan) return;
    const days = [...activePlan.days, { id: uid(), dia: `Dia ${activePlan.days.length + 1}`, foco: "", exercicios: [] }];
    saveDays(days); setDayIdx(days.length - 1);
  }
  function removeDay(i: number) {
    if (!activePlan) return;
    saveDays(activePlan.days.filter((_, idx) => idx !== i)); setDayIdx(0);
  }
  function patchDay(i: number, patch: Partial<WorkoutDay>) {
    if (!activePlan) return;
    saveDays(activePlan.days.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function addExercise(i: number) {
    if (!activePlan) return;
    saveDays(activePlan.days.map((dd, idx) =>
      idx === i ? { ...dd, exercicios: [...dd.exercicios, { id: uid(), nome: "Novo exercício", series: 3, reps: "10" }] } : dd));
  }
  function removeExercise(i: number, exId: string) {
    if (!activePlan) return;
    saveDays(activePlan.days.map((dd, idx) =>
      idx === i ? { ...dd, exercicios: dd.exercicios.filter((e) => e.id !== exId) } : dd));
  }
  function patchExercise(i: number, exId: string, patch: Partial<{ nome: string; series: number; reps: string }>) {
    if (!activePlan) return;
    saveDays(activePlan.days.map((dd, idx) =>
      idx === i ? { ...dd, exercicios: dd.exercicios.map((e) => (e.id === exId ? { ...e, ...patch } : e)) } : dd));
  }

  // Execução: abrir modal de peso ao adicionar série.
  function openWeightModal(exId: string, exName: string, target: number) {
    const last = prog[exId]?.weights?.slice(-1)[0];
    setWeightInput(last != null ? String(last) : "");
    setWeightModal({ exId, exName, target });
  }
  async function confirmSerie() {
    if (!weightModal || !activePlan || !activeDay) return;
    const { exId, target } = weightModal;
    const weight = Number(weightInput) || 0;
    setWeightModal(null);
    if (!active) startTimer();
    try {
      const r = await fnLogSerie({ data: { planId: activePlan.id, dayKey: activeDay.id, exerciseKey: exId, target, weight } });
      setProg((p) => ({ ...p, [exId]: { done: r.done, series: r.series, weights: r.weights } }));
    } catch { loadProgress(); }
  }
  async function removeSerie(exId: string) {
    if (!activePlan || !activeDay) return;
    try {
      const r = await fnUndoSerie({ data: { planId: activePlan.id, dayKey: activeDay.id, exerciseKey: exId } });
      setProg((p) => ({ ...p, [exId]: { done: r.done, series: r.series, weights: r.weights } }));
    } catch { loadProgress(); }
  }

  async function confirmFinish() {
    if (!activePlan || !activeDay) return;
    const total = activeDay.exercicios.length;
    const done = activeDay.exercicios.filter((e) => prog[e.id]?.done).length;
    const durationSec = elapsed;
    setFinishOpen(false);
    setActive(false); setRunning(false); setStartedAt(null); setAccum(0);
    try {
      await fnCreateSession({ data: { planId: activePlan.id, durationSec, exercisesDone: done, exercisesTotal: total } });
      setSessions(await fnSessions({ data: { planId: activePlan.id } }));
      toast.success("Sessão registrada.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao registrar sessão."); }
  }

  const doneCount = activeDay ? activeDay.exercicios.filter((e) => prog[e.id]?.done).length : 0;
  const total = activeDay?.exercicios.length ?? 0;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  // Primeiro exercício não-concluído = foco (auto-avanço).
  const focusId = activeDay?.exercicios.find((e) => !prog[e.id]?.done)?.id ?? null;

  return (
    <MobileShell>
      <header
        className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-charcoal-900/85 pb-3 pl-14 pr-4 pt-5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <span className="ember-glow grid h-10 w-10 place-items-center rounded-2xl bg-charcoal-800 text-ember">
          <Dumbbell className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl leading-none tracking-wide text-foreground">TREINO</h1>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">Planos, execução e histórico</p>
        </div>
        {activePlan && (
          <button type="button" onClick={() => setEditing((e) => !e)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground active:scale-95" aria-label={editing ? "Concluir edição" : "Editar plano"}>
            {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </button>
        )}
      </header>

      {plans === null ? (
        <div className="space-y-2.5 px-4 pt-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-charcoal-800" />)}
        </div>
      ) : (
        <>
          {/* Planos */}
          <section className="px-4 pt-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {plans.map((p) => (
                <button key={p.id} type="button" onClick={() => setActiveId(p.id)}
                  className={"shrink-0 rounded-xl border px-3 py-2 font-display text-[12px] tracking-wide " + (p.id === activeId ? "border-ember/60 bg-ember/10 text-ember" : "border-border text-muted-foreground")}>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleCreatePlan(); }} placeholder="Novo treino…"
                className="flex-1 rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ember/60 focus:outline-none" />
              <button type="button" onClick={handleCreatePlan} disabled={!newPlanName.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ember text-charcoal-900 disabled:opacity-50 active:scale-95" aria-label="Criar treino">
                <Plus className="h-5 w-5" strokeWidth={2.4} />
              </button>
            </div>
          </section>

          {!activePlan ? (
            <section className="px-4 pt-8">
              <div className="forge-card rounded-2xl px-4 py-8 text-center text-muted-foreground">
                Crie seu primeiro treino acima, ou monte um com a IA.
              </div>
            </section>
          ) : (
            <>
              {activePlan.days.length > 0 && (
                <section className="px-4 pt-4">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {activePlan.days.map((d, i) => (
                      <button key={d.id} type="button" onClick={() => setDayIdx(i)}
                        className={"shrink-0 rounded-lg border px-3 py-1.5 font-display text-[11px] tracking-wide " + (i === dayIdx ? "border-ember/60 bg-ember/10 text-ember" : "border-border text-muted-foreground")}>
                        {d.dia}
                      </button>
                    ))}
                    {editing && (
                      <button type="button" onClick={addDay} className="shrink-0 rounded-lg border border-dashed border-ember/40 px-3 py-1.5 text-ember"><Plus className="h-4 w-4" /></button>
                    )}
                  </div>
                </section>
              )}

              {editing ? (
                <section className="space-y-4 px-4 pt-4">
                  <div>
                    <label className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">NOME DO PLANO</label>
                    <input defaultValue={activePlan.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== activePlan.name) handleRename(v); }}
                      className="mt-1 w-full rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground focus:border-ember/60 focus:outline-none" />
                  </div>
                  {activeDay ? (
                    <div className="forge-card rounded-2xl p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <input defaultValue={activeDay.dia} onBlur={(e) => patchDay(dayIdx, { dia: e.target.value.trim() || activeDay.dia })} className="w-24 rounded-lg border border-border bg-charcoal-900 px-2 py-1.5 text-sm text-foreground focus:border-ember/60 focus:outline-none" />
                        <input defaultValue={activeDay.foco ?? ""} placeholder="foco" onBlur={(e) => patchDay(dayIdx, { foco: e.target.value })} className="flex-1 rounded-lg border border-border bg-charcoal-900 px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ember/60 focus:outline-none" />
                        <button type="button" onClick={() => removeDay(dayIdx)} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground" aria-label="Remover dia"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <div className="space-y-2">
                        {activeDay.exercicios.map((ex) => (
                          <div key={ex.id} className="flex items-center gap-2">
                            <input defaultValue={ex.nome} onBlur={(e) => patchExercise(dayIdx, ex.id, { nome: e.target.value.trim() || ex.nome })} className="min-w-0 flex-1 rounded-lg border border-border bg-charcoal-900 px-2 py-1.5 text-sm text-foreground focus:border-ember/60 focus:outline-none" />
                            <input type="number" defaultValue={ex.series ?? 3} onBlur={(e) => patchExercise(dayIdx, ex.id, { series: Number(e.target.value) || 0 })} className="w-12 rounded-lg border border-border bg-charcoal-900 px-1.5 py-1.5 text-center text-sm text-foreground focus:border-ember/60 focus:outline-none" aria-label="séries" />
                            <input defaultValue={ex.reps ?? ""} placeholder="reps" onBlur={(e) => patchExercise(dayIdx, ex.id, { reps: e.target.value })} className="w-16 rounded-lg border border-border bg-charcoal-900 px-1.5 py-1.5 text-center text-sm text-foreground placeholder:text-muted-foreground focus:border-ember/60 focus:outline-none" aria-label="repetições" />
                            <button type="button" onClick={() => removeExercise(dayIdx, ex.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground" aria-label="Remover exercício"><X className="h-4 w-4" /></button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addExercise(dayIdx)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ember/40 py-2 font-display text-[11px] tracking-[0.2em] text-ember"><Plus className="h-4 w-4" /> EXERCÍCIO</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={addDay} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-ember/40 py-4 font-display text-sm tracking-wide text-ember"><Plus className="h-4 w-4" /> Adicionar dia</button>
                  )}
                  <button type="button" onClick={handleDeletePlan} className="flex items-center gap-1.5 text-[11px] tracking-[0.2em] text-muted-foreground active:text-destructive"><Trash2 className="h-3.5 w-3.5" /> EXCLUIR TREINO</button>
                </section>
              ) : (
                <>
                  {activeDay && activeDay.exercicios.length > 0 ? (
                    <section className="px-4 pt-4">
                      <div className="mb-3 flex items-center gap-3">
                        <h2 className="font-display text-lg tracking-[0.14em] text-foreground">{activeDay.dia}{activeDay.foco ? ` · ${activeDay.foco}` : ""}</h2>
                        <span className="h-px flex-1 bg-border" />
                        <span className="font-display text-[10px] tracking-[0.2em] text-ember">{doneCount}/{total}</span>
                      </div>
                      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-charcoal-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-ember to-ember-glow transition-all" style={{ width: `${pct}%` }} />
                      </div>

                      {/* Cronômetro + controles */}
                      <div className="forge-card mb-3 flex items-center justify-between rounded-2xl p-3">
                        <span className="font-display text-2xl tabular-nums text-foreground">{active ? fmtDur(elapsed) : "0:00"}</span>
                        <div className="flex gap-2">
                          {!active ? (
                            <button type="button" onClick={startTimer} className="flex items-center gap-2 rounded-xl bg-ember px-4 py-2.5 font-display text-sm tracking-wide text-charcoal-900 active:scale-[0.98]"><Play className="h-4 w-4" strokeWidth={2.6} /> Iniciar</button>
                          ) : (
                            <>
                              <button type="button" onClick={running ? pauseTimer : resumeTimer} className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-charcoal-900 text-foreground active:scale-95" aria-label={running ? "Pausar" : "Retomar"}>
                                {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                              </button>
                              <button type="button" onClick={() => setFinishOpen(true)} className="flex items-center gap-2 rounded-xl border border-ember/50 bg-charcoal-900 px-4 py-2.5 font-display text-sm tracking-wide text-ember active:scale-[0.98]"><Square className="h-4 w-4" strokeWidth={2.6} /> Finalizar</button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {activeDay.exercicios.map((ex) => {
                          const target = targetOf(ex.series);
                          const st = prog[ex.id] ?? { done: false, series: 0, weights: [] };
                          const isFocus = ex.id === focusId;
                          return (
                            <div key={ex.id} className={"forge-card flex items-center gap-3 rounded-2xl px-3.5 py-3 " + (isFocus ? "ring-1 ring-ember/50" : "")}>
                              <span className={"grid h-10 w-10 shrink-0 place-items-center rounded-xl border " + (st.done ? "border-ember/40 bg-ember text-charcoal-900 ember-glow" : "border-border bg-charcoal-900 text-muted-foreground")}>
                                <Check className="h-5 w-5" strokeWidth={3} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className={"truncate font-display text-base tracking-wide " + (st.done ? "text-muted-foreground line-through" : "text-foreground")}>{ex.nome}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {st.series}/{target} séries{ex.reps ? ` · ${ex.reps} reps` : ""}
                                  {st.weights.length > 0 ? ` · ${st.weights[st.weights.length - 1]}kg` : ""}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                {st.series > 0 && (
                                  <button type="button" onClick={() => removeSerie(ex.id)} className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-charcoal-900 text-muted-foreground active:scale-95" aria-label="Remover série"><Minus className="h-4 w-4" /></button>
                                )}
                                <button type="button" onClick={() => openWeightModal(ex.id, ex.nome, target)} disabled={st.done} className="grid h-9 w-9 place-items-center rounded-xl border border-ember/50 bg-charcoal-900 text-ember disabled:opacity-40 active:scale-95" aria-label="Adicionar série"><Plus className="h-4 w-4" strokeWidth={2.6} /></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : (
                    <section className="px-4 pt-6">
                      <div className="forge-card rounded-2xl px-4 py-8 text-center text-muted-foreground">
                        {activePlan.days.length === 0 ? "Esse treino ainda não tem dias. Toque no lápis pra montar." : "Esse dia não tem exercícios. Toque no lápis pra adicionar."}
                      </div>
                    </section>
                  )}

                  {sessions.length > 0 && (
                    <section className="px-4 pt-6">
                      <header className="mb-2 flex items-center gap-3">
                        <h2 className="font-display text-sm tracking-[0.3em] text-foreground">HISTÓRICO</h2>
                        <span className="h-px flex-1 bg-border" />
                      </header>
                      <div className="space-y-1.5">
                        {sessions.map((s) => (
                          <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-charcoal-900 px-3 py-2 text-sm">
                            <span className="text-muted-foreground">{s.session_date}</span>
                            <span className="text-foreground">{s.exercises_done}/{s.exercises_total} · {fmtDur(s.duration_sec)}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          )}

          <Link to="/assistente" className="forge-card mx-4 mb-8 mt-6 flex items-center gap-3 rounded-2xl p-3.5 active:forge-press-active">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-charcoal-900 text-ember"><Sparkles className="h-5 w-5" strokeWidth={2.2} /></span>
            <span className="flex-1">
              <span className="block font-display text-base tracking-wide text-foreground">Montar treino com a IA</span>
              <span className="block text-[11px] text-muted-foreground">“treino de força 3x na semana”</span>
            </span>
            <ChevronRight className="h-4 w-4 text-ember" />
          </Link>
        </>
      )}

      {/* Pop-up de peso */}
      {weightModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-6" onClick={() => setWeightModal(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-border bg-charcoal-900 p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-[10px] tracking-[0.3em] text-ember">REGISTRAR SÉRIE</p>
            <p className="mt-1 font-display text-lg tracking-wide text-foreground">{weightModal.exName}</p>
            <p className="text-[11px] text-muted-foreground">Série {(prog[weightModal.exId]?.series ?? 0) + 1} de {weightModal.target}</p>
            <div className="mt-3 flex items-center gap-2">
              <input autoFocus type="number" inputMode="decimal" value={weightInput} onChange={(e) => setWeightInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmSerie(); }}
                placeholder="peso" className="flex-1 rounded-xl border border-border bg-charcoal-800 px-3 py-2.5 text-center text-lg text-foreground focus:border-ember/60 focus:outline-none" />
              <span className="font-display text-sm text-muted-foreground">kg</span>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={confirmSerie} className="flex-1 rounded-xl bg-ember py-2.5 font-display text-sm tracking-wide text-charcoal-900 active:scale-[0.99]">Registrar</button>
              <button type="button" onClick={() => setWeightModal(null)} className="rounded-xl border border-border bg-charcoal-800 px-4 py-2.5 font-display text-sm text-muted-foreground">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de finalização */}
      {finishOpen && activeDay && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-6" onClick={() => setFinishOpen(false)}>
          <div className="w-full max-w-xs rounded-2xl border border-border bg-charcoal-900 p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-[10px] tracking-[0.3em] text-ember">FINALIZAR TREINO?</p>
            <div className="mt-3 space-y-1 text-sm text-foreground">
              <div className="flex justify-between"><span className="text-muted-foreground">Tempo</span><span>{fmtDur(elapsed)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Exercícios</span><span>{doneCount}/{total}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Séries feitas</span><span>{activeDay.exercicios.reduce((s, e) => s + (prog[e.id]?.series ?? 0), 0)}</span></div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={confirmFinish} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ember py-2.5 font-display text-sm tracking-wide text-charcoal-900"><Check className="h-4 w-4" strokeWidth={3} /> Finalizar</button>
              <button type="button" onClick={() => setFinishOpen(false)} className="rounded-xl border border-border bg-charcoal-800 px-4 py-2.5 font-display text-sm text-muted-foreground">Voltar</button>
            </div>
          </div>
        </div>
      )}

      <div className="h-24" />
    </MobileShell>
  );
}
