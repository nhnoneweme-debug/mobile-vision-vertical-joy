import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Droplet, Plus } from "lucide-react";
import { toast } from "sonner";
import { confirmFoodLog } from "@/lib/food-log.functions";

/** Padrão quando a pessoa não tem meta no plano alimentar. */
export const WATER_GOAL_FALLBACK_ML = 2000;

/** Registros rápidos — os volumes que aparecem no dia a dia. */
const QUICK_ML = [
  { ml: 200, label: "Copo" },
  { ml: 500, label: "Garrafa" },
  { ml: 1000, label: "1L" },
];

/**
 * Anel de hidratação, par do CalorieRing.
 *
 * A meta (hydration_ml) já vinha do plano alimentar; o consumido sai da soma de
 * food_log_entries.water_ml do dia. A água continua sendo uma entrada do diário
 * (0 kcal), então ela aparece no histórico e pode ser removida como qualquer
 * outra — em vez de virar um registro paralelo.
 */
export function WaterRing({
  consumedMl,
  goalMl,
  onLogged,
}: {
  consumedMl: number;
  goalMl: number | null;
  onLogged: () => void;
}) {
  const fnConfirm = useServerFn(confirmFoodLog);
  const [busy, setBusy] = useState<number | null>(null);

  const goal = goalMl && goalMl > 0 ? goalMl : WATER_GOAL_FALLBACK_ML;
  const size = 190;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, consumedMl / goal));

  async function addWater(ml: number) {
    if (busy) return;
    setBusy(ml);
    try {
      await fnConfirm({
        data: {
          name: "Água",
          kcal: 0,
          quantity_text: ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`,
          source: "manual",
          water_ml: ml,
        },
      });
      onLogged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui registrar a água.");
    } finally {
      setBusy(null);
    }
  }

  const litros = (n: number) => (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="var(--charcoal-800)"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="var(--water)"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c * pct} ${c}`}
            className="transition-[stroke-dasharray] duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[9px] tracking-[0.25em] text-muted-foreground">
            ÁGUA HOJE
          </span>
          <span className="font-display text-4xl leading-none text-foreground">
            {litros(consumedMl)}
            <span className="text-xl">L</span>
          </span>
          <span className="mt-1 font-display text-[9px] tracking-[0.2em] text-muted-foreground">
            META {litros(goal)}L
          </span>
        </div>
      </div>

      <div className="w-full min-w-0 flex-1">
        <p className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">
          HIDRATAÇÃO / META
        </p>
        <p className="mt-1 font-display text-lg text-foreground">
          {consumedMl}
          <span className="text-sm text-muted-foreground"> / {goal} ML</span>
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {consumedMl >= goal
            ? "Meta batida hoje."
            : `Faltam ${goal - consumedMl} ml${goalMl ? "" : " (meta padrão — defina no plano)"}`}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_ML.map((q) => (
            <button
              key={q.ml}
              type="button"
              onClick={() => addWater(q.ml)}
              disabled={busy !== null}
              aria-label={`Registrar ${q.label} de ${q.ml} mililitros`}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--water)]/40 bg-[var(--water)]/10 px-3 py-2 text-[var(--water)] transition-colors disabled:opacity-40"
            >
              {busy === q.ml ? (
                <Droplet className="h-4 w-4 animate-pulse" />
              ) : (
                <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
              )}
              <span className="font-display text-xs tracking-[0.1em]">{q.label}</span>
              <span className="text-[10px] opacity-70">{q.ml}ml</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
