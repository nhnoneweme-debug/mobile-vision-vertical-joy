import { X, Plus, Clock } from "lucide-react";
import type { Meal } from "@/lib/cozinha.functions";

// Editor estruturado de dieta (add/editar/remover refeições) na forma nativa do
// DietPlan. Reutilizável; a persistência fica a cargo de quem usa (via saveDietPlan).
export type DietDraft = {
  meals: Meal[];
  hydration_ml: number | null;
  daily_kcal_target: number | null;
};

const fieldCls =
  "w-full rounded-lg border border-border bg-charcoal-900 px-2.5 py-2 text-sm text-foreground focus:border-ember/60 focus:outline-none";

export function DietEditor({
  value,
  onChange,
}: {
  value: DietDraft;
  onChange: (d: DietDraft) => void;
}) {
  const meals = value.meals;

  const setMeal = (i: number, patch: Partial<Meal>) => {
    const next = meals.map((m, x) => (x === i ? { ...m, ...patch } : m));
    onChange({ ...value, meals: next });
  };
  const addMeal = () =>
    onChange({ ...value, meals: [...meals, { time: "12:00", name: "Nova refeição", items: [] }] });
  const removeMeal = (i: number) => onChange({ ...value, meals: meals.filter((_, x) => x !== i) });

  const numOrNull = (v: string) => (v.trim() === "" ? null : Math.max(0, Number(v) || 0));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="mb-1 block font-display text-[9px] tracking-[0.2em] text-muted-foreground">
            HIDRATAÇÃO (ML/DIA)
          </span>
          <input
            type="number"
            inputMode="numeric"
            className={fieldCls}
            value={value.hydration_ml ?? ""}
            placeholder="2500"
            onChange={(e) => onChange({ ...value, hydration_ml: numOrNull(e.target.value) })}
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block font-display text-[9px] tracking-[0.2em] text-muted-foreground">
            META (KCAL/DIA)
          </span>
          <input
            type="number"
            inputMode="numeric"
            className={fieldCls}
            value={value.daily_kcal_target ?? ""}
            placeholder="2000"
            onChange={(e) => onChange({ ...value, daily_kcal_target: numOrNull(e.target.value) })}
          />
        </label>
      </div>

      <div className="space-y-2">
        {meals.map((m, i) => (
          <div key={i} className="rounded-lg border border-border bg-charcoal-900 p-2">
            <div className="mb-1 flex gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-border bg-charcoal-800 px-2">
                <Clock className="h-3.5 w-3.5 text-ember" />
                <input
                  className="w-14 bg-transparent py-2 text-sm text-foreground focus:outline-none"
                  value={m.time}
                  placeholder="12:00"
                  onChange={(e) => setMeal(i, { time: e.target.value })}
                  aria-label="horário"
                />
              </div>
              <input
                className={fieldCls}
                value={m.name}
                placeholder="Nome da refeição"
                onChange={(e) => setMeal(i, { name: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeMeal(i)}
                aria-label="Remover refeição"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              className={fieldCls}
              rows={2}
              value={m.items.join(", ")}
              placeholder="itens separados por vírgula"
              onChange={(e) =>
                setMeal(i, {
                  items: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addMeal}
        disabled={meals.length >= 12}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 font-display text-[11px] tracking-[0.2em] text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" /> ADICIONAR REFEIÇÃO
      </button>
    </div>
  );
}
