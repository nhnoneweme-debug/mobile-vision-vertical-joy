import { ArrowRight, Check, Zap } from "lucide-react";
import type { DailyQuestRow } from "@/lib/quests";

export function QuestOfDayCard({
  quest,
  onCheckin,
}: {
  quest: DailyQuestRow;
  onCheckin: () => void;
}) {
  const done = quest.status === "completed";

  return (
    <div
      className={`ember-glow block rounded-2xl border bg-gradient-to-br from-charcoal-800 to-charcoal-900 p-4 ${
        done ? "border-ember/60" : "border-ember/30"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="font-display text-[10px] tracking-[0.3em] text-ember">
          QUEST DO DIA
        </span>
        <span className="h-px flex-1 bg-border" />
        <span className="flex items-center gap-1 font-display text-[11px] tracking-[0.2em] text-foreground">
          <Zap className="h-3 w-3 text-ember" strokeWidth={2.5} />
          +{quest.xp_reward} XP
        </span>
      </div>

      <h3 className="mt-2 font-display text-3xl leading-none tracking-wide text-foreground">
        {quest.title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{quest.subtitle}</p>

      <div className="mt-4">
        {done ? (
          <div className="flex items-center justify-between rounded-xl border border-ember/40 bg-ember/10 px-3 py-2.5">
            <span className="flex items-center gap-2 font-display text-xs tracking-[0.2em] text-ember">
              <Check className="h-4 w-4" strokeWidth={2.6} />
              CONCLUÍDA HOJE
            </span>
            {quest.effort != null && (
              <span className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">
                ESFORÇO · {quest.effort}/5
              </span>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onCheckin}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-ember bg-ember/15 px-4 py-3 font-display tracking-[0.2em] text-ember active:scale-[0.99]"
          >
            FAZER CHECK-IN <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
