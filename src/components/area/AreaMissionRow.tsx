import { Check, Sparkles, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AreaMissionWithMeta } from "@/lib/area-missions";

type Props = {
  mission: AreaMissionWithMeta;
  pending: boolean;
  onLog: () => void;
  onUndo: () => void;
};

export function AreaMissionRow({ mission, pending, onLog, onUndo }: Props) {
  const done = mission.week_done;
  const target = mission.weekly_target;
  const complete = done >= target;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 transition-colors",
        complete ? "border-ember/50" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onLog}
          disabled={pending}
          aria-label={`Registrar ${mission.title}`}
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-all active:scale-95",
            complete
              ? "border-ember bg-ember text-charcoal-950"
              : "border-border bg-charcoal-900 text-ember hover:border-ember/60",
            pending && "opacity-50",
          )}
        >
          {complete ? <Check className="h-5 w-5" strokeWidth={2.6} /> : <span className="font-display text-base">+</span>}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg leading-tight tracking-wide text-foreground">
              {mission.title}
            </h3>
            <span className="shrink-0 rounded-md bg-ember/15 px-1.5 py-0.5 font-display text-[10px] tracking-[0.18em] text-ember">
              +{mission.xp_reward}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{mission.subtitle}</p>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-charcoal-800">
                <div
                  className="h-full bg-ember transition-all"
                  style={{ width: `${Math.min(100, (done / target) * 100)}%` }}
                />
              </div>
              <span className="font-display text-[10px] tracking-[0.18em] text-muted-foreground">
                {done}/{target} SEM
              </span>
            </div>
            <div className="flex items-center gap-2">
              {mission.affinity_match && (
                <span className="flex items-center gap-1 font-display text-[9px] tracking-[0.18em] text-ember">
                  <Sparkles className="h-3 w-3" strokeWidth={2.4} /> AFINIDADE
                </span>
              )}
              {mission.last_log_id && (
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={pending}
                  className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
                  aria-label="Desfazer último registro"
                >
                  <Undo2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
