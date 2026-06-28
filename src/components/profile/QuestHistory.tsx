import { Check, Circle } from "lucide-react";
import type { DailyQuestRow } from "@/lib/quests";

export function QuestHistory({ quests }: { quests: DailyQuestRow[] }) {
  if (!quests.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Nenhuma quest registrada ainda. Comece pelo Mapa.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {quests.map((q) => {
        const done = q.status === "completed";
        const date = new Date(q.quest_date + "T00:00:00");
        const label = date.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
        });
        return (
          <li
            key={q.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
          >
            <div
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${
                done
                  ? "border-ember/60 bg-ember/15 text-ember"
                  : "border-border bg-charcoal-900 text-muted-foreground"
              }`}
            >
              {done ? (
                <Check className="h-4 w-4" strokeWidth={2.6} />
              ) : (
                <Circle className="h-3 w-3" strokeWidth={2.4} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base leading-tight tracking-wide text-foreground">
                {q.title}
              </p>
              <p className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">
                {label.toUpperCase()} · {q.area_slug.toUpperCase()}
                {done && q.effort ? ` · ESF ${q.effort}/5` : ""}
              </p>
            </div>
            {done && (
              <span className="font-display text-xs tracking-[0.2em] text-ember">
                +{q.xp_reward}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
