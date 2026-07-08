import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Dumbbell, Check, Sparkles, Flame, RotateCcw } from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";

export const Route = createFileRoute("/_authenticated/treino")({
  head: () => ({ meta: [{ title: "Treino — Personal IA" }] }),
  component: TreinoPage,
});

type Exercise = { id: string; name: string; detail: string; done: boolean };

const SEED: Exercise[] = [
  { id: "e1", name: "Agachamento livre", detail: "4 × 8–10", done: false },
  { id: "e2", name: "Supino reto", detail: "4 × 8", done: false },
  { id: "e3", name: "Remada curvada", detail: "4 × 10", done: false },
  { id: "e4", name: "Desenvolvimento", detail: "3 × 10", done: false },
  { id: "e5", name: "Prancha", detail: "3 × 45s", done: false },
];

const WEEK_KEY = "treino.week.sessions";

function TreinoPage() {
  const [exercises, setExercises] = useState<Exercise[]>(SEED);
  const [sessions, setSessions] = useState<number>(() => {
    try { return Number(localStorage.getItem(WEEK_KEY) || 0); } catch { return 0; }
  });

  const done = exercises.filter((e) => e.done).length;
  const pct = Math.round((done / exercises.length) * 100);

  function toggle(id: string) {
    setExercises((xs) => xs.map((e) => (e.id === id ? { ...e, done: !e.done } : e)));
  }

  function finishSession() {
    const next = sessions + 1;
    setSessions(next);
    try { localStorage.setItem(WEEK_KEY, String(next)); } catch { /* noop */ }
    setExercises((xs) => xs.map((e) => ({ ...e, done: false })));
  }

  return (
    <MobileShell>
      <header
        className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-charcoal-900/85 pb-3 pl-14 pr-4 pt-5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <span className="ember-glow grid h-10 w-10 place-items-center rounded-2xl bg-charcoal-800 text-ember">
          <Dumbbell className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div>
          <h1 className="font-display text-xl leading-none tracking-wide text-foreground">TREINO</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Plano do dia e registro de sessões</p>
        </div>
      </header>

      {/* Resumo semanal */}
      <section className="px-4 pt-4">
        <div className="forge-card flex items-center justify-between rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-charcoal-900 text-ember">
              <Flame className="h-6 w-6 ember-pulse" strokeWidth={2.2} />
            </span>
            <div>
              <p className="font-display text-2xl leading-none text-foreground">{sessions}<span className="text-muted-foreground text-base"> / 5</span></p>
              <p className="mt-0.5 font-display text-[10px] tracking-[0.25em] text-muted-foreground">SESSÕES NA SEMANA</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setSessions(0); try { localStorage.setItem(WEEK_KEY, "0"); } catch { /* noop */ } }}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground active:scale-95"
            aria-label="Zerar semana"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Treino do dia */}
      <section className="px-4 pt-5">
        <header className="mb-3 flex items-center gap-3">
          <h2 className="font-display text-xl tracking-[0.16em] text-foreground">TREINO DE HOJE</h2>
          <span className="h-px flex-1 bg-border" />
          <span className="font-display text-[10px] tracking-[0.2em] text-ember">{done}/{exercises.length}</span>
        </header>

        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-charcoal-800">
          <div className="h-full rounded-full bg-gradient-to-r from-ember to-ember-glow transition-all" style={{ width: `${pct}%` }} />
        </div>

        <div className="space-y-2.5">
          {exercises.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => toggle(e.id)}
              className="forge-card forge-press flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left active:forge-press-active"
            >
              <span
                className={
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl border " +
                  (e.done ? "border-ember/40 bg-ember text-charcoal-900 ember-glow" : "border-border bg-charcoal-900 text-muted-foreground")
                }
              >
                <Check className="h-5 w-5" strokeWidth={3} />
              </span>
              <span className="flex-1">
                <span className={"block font-display text-base tracking-wide " + (e.done ? "text-muted-foreground line-through" : "text-foreground")}>
                  {e.name}
                </span>
                <span className="block text-[11px] text-muted-foreground">{e.detail}</span>
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={finishSession}
          disabled={done === 0}
          className="mt-4 w-full rounded-xl bg-ember py-3 font-display text-base tracking-wide text-charcoal-900 active:scale-[0.99] disabled:opacity-50"
        >
          Concluir treino {done > 0 ? `(+${done})` : ""}
        </button>
      </section>

      <Link
        to="/assistente"
        className="forge-card mx-4 mb-8 mt-5 flex items-center gap-3 rounded-2xl p-3.5 active:forge-press-active"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-charcoal-900 text-ember">
          <Sparkles className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <span className="flex-1">
          <span className="block font-display text-base tracking-wide text-foreground">Montar treino com a IA</span>
          <span className="block text-[11px] text-muted-foreground">“treino de força 3x na semana”</span>
        </span>
      </Link>

      <div className="h-24" />
    </MobileShell>
  );
}
