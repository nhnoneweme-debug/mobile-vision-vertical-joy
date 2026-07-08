import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Utensils, Check, Sparkles, Droplet, Minus, Plus } from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";

export const Route = createFileRoute("/_authenticated/plano-alimentar")({
  head: () => ({ meta: [{ title: "Plano Alimentar — Personal IA" }] }),
  component: PlanoPage,
});

type Meal = { id: string; time: string; name: string; items: string; kcal: number; done: boolean };

const SEED: Meal[] = [
  { id: "m1", time: "07:30", name: "Café da manhã", items: "Ovos, aveia, fruta", kcal: 420, done: false },
  { id: "m2", time: "12:30", name: "Almoço", items: "Arroz, feijão, frango, salada", kcal: 650, done: false },
  { id: "m3", time: "16:00", name: "Lanche", items: "Iogurte, castanhas", kcal: 250, done: false },
  { id: "m4", time: "20:00", name: "Jantar", items: "Peixe, legumes, batata-doce", kcal: 520, done: false },
];

const WATER_GOAL = 8;

function PlanoPage() {
  const [meals, setMeals] = useState<Meal[]>(SEED);
  const [water, setWater] = useState(0);

  const kcalTotal = SEED.reduce((s, m) => s + m.kcal, 0);
  const kcalDone = meals.filter((m) => m.done).reduce((s, m) => s + m.kcal, 0);

  function toggle(id: string) {
    setMeals((ms) => ms.map((m) => (m.id === id ? { ...m, done: !m.done } : m)));
  }

  return (
    <MobileShell>
      <header
        className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-charcoal-900/85 pb-3 pl-14 pr-4 pt-5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <span className="ember-glow grid h-10 w-10 place-items-center rounded-2xl bg-charcoal-800 text-ember">
          <Utensils className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div>
          <h1 className="font-display text-xl leading-none tracking-wide text-foreground">PLANO ALIMENTAR</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Refeições do dia e hidratação</p>
        </div>
      </header>

      {/* Resumo do dia */}
      <section className="px-4 pt-4">
        <div className="forge-card rounded-2xl p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-display text-2xl leading-none text-foreground">
                {kcalDone}<span className="text-base text-muted-foreground"> / {kcalTotal} kcal</span>
              </p>
              <p className="mt-0.5 font-display text-[10px] tracking-[0.25em] text-muted-foreground">CONSUMIDO HOJE</p>
            </div>
            <span className="font-display text-[10px] tracking-[0.2em] text-ember">
              {meals.filter((m) => m.done).length}/{meals.length} REFEIÇÕES
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-charcoal-800">
            <div className="h-full rounded-full bg-gradient-to-r from-ember to-ember-glow transition-all" style={{ width: `${Math.round((kcalDone / kcalTotal) * 100)}%` }} />
          </div>
        </div>
      </section>

      {/* Água */}
      <section className="px-4 pt-4">
        <div className="forge-card flex items-center justify-between rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-charcoal-900 text-ember">
              <Droplet className="h-6 w-6" strokeWidth={2.2} />
            </span>
            <div>
              <p className="font-display text-xl leading-none text-foreground">{water}<span className="text-base text-muted-foreground"> / {WATER_GOAL} copos</span></p>
              <p className="mt-0.5 font-display text-[10px] tracking-[0.25em] text-muted-foreground">ÁGUA</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setWater((w) => Math.max(0, w - 1))} className="grid h-10 w-10 place-items-center rounded-xl border border-border text-foreground active:scale-95" aria-label="Menos água">
              <Minus className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => setWater((w) => Math.min(WATER_GOAL, w + 1))} className="grid h-10 w-10 place-items-center rounded-xl bg-ember text-charcoal-900 active:scale-95" aria-label="Mais água">
              <Plus className="h-5 w-5" strokeWidth={2.6} />
            </button>
          </div>
        </div>
      </section>

      {/* Refeições */}
      <section className="px-4 pt-5">
        <header className="mb-3 flex items-center gap-3">
          <h2 className="font-display text-xl tracking-[0.16em] text-foreground">REFEIÇÕES</h2>
          <span className="h-px flex-1 bg-border" />
        </header>

        <div className="space-y-2.5">
          {meals.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              className="forge-card forge-press flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left active:forge-press-active"
            >
              <span className="grid w-12 shrink-0 place-items-center rounded-xl bg-charcoal-900 py-1.5">
                <span className="font-display text-sm leading-none text-ember">{m.time}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className={"block font-display text-base tracking-wide " + (m.done ? "text-muted-foreground line-through" : "text-foreground")}>
                  {m.name}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">{m.items} · {m.kcal} kcal</span>
              </span>
              <span
                className={
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl border " +
                  (m.done ? "border-ember/40 bg-ember text-charcoal-900 ember-glow" : "border-border bg-charcoal-900 text-muted-foreground")
                }
              >
                <Check className="h-5 w-5" strokeWidth={3} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <Link
        to="/assistente"
        className="forge-card mx-4 mb-8 mt-5 flex items-center gap-3 rounded-2xl p-3.5 active:forge-press-active"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-charcoal-900 text-ember">
          <Sparkles className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <span className="flex-1">
          <span className="block font-display text-base tracking-wide text-foreground">Montar plano com a IA</span>
          <span className="block text-[11px] text-muted-foreground">“plano alimentar de 2000 kcal”</span>
        </span>
      </Link>

      <div className="h-24" />
    </MobileShell>
  );
}
