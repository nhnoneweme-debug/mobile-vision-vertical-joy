// Timeline vertical dos blocos da jornada de hoje.
// Estado visual por bloco: feito / agora (ember + glow) / futuro.

import { Check, Circle, Sparkles } from "lucide-react";
import type { JourneyBlock } from "@/hooks/useActiveJourney";

function fmtHM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function humanRemain(min: number): string {
  if (min <= 0) return "agora";
  if (min < 60) return `em ${min}min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `em ${h}h${String(rest).padStart(2, "0")}` : `em ${h}h`;
}

export type TimelineItem = {
  block: JourneyBlock;
  state: "done" | "now" | "future";
  remaining?: number; // minutos até o fim (agora) ou início (futuro)
};

export function JourneyTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-charcoal-800/40 p-6 text-center text-sm text-muted-foreground">
        Nenhum bloco planejado hoje. Peça pra WiMi montar sua jornada.
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {items.map(({ block, state, remaining }) => {
        const isNow = state === "now";
        const isDone = state === "done";
        return (
          <li
            key={block.id}
            className={[
              "flex items-center gap-3 rounded-xl border p-3 transition",
              isNow
                ? "border-ember/50 bg-ember/10 shadow-[0_0_24px_-8px] shadow-ember/40"
                : isDone
                  ? "border-border/40 bg-charcoal-800/30 opacity-60"
                  : "border-border bg-charcoal-800/40",
            ].join(" ")}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border/60 bg-charcoal-900/70">
              {isDone ? (
                <Check className="h-4 w-4 text-muted-foreground" />
              ) : isNow ? (
                <Sparkles className="h-4 w-4 text-ember" />
              ) : (
                <Circle className="h-3 w-3 text-muted-foreground" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-sm ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}
              >
                {block.title}
              </p>
              <p className="mt-0.5 font-display text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {fmtHM(block.startMin)}–{fmtHM(block.endMin)}
                {block.area ? ` · ${block.area}` : ""}
              </p>
            </div>
            {isNow && remaining != null ? (
              <span className="shrink-0 rounded-full bg-ember/20 px-2 py-0.5 font-display text-[10px] tracking-[0.15em] text-ember">
                {remaining}min
              </span>
            ) : state === "future" && remaining != null ? (
              <span className="shrink-0 font-display text-[10px] tracking-[0.12em] text-muted-foreground">
                {humanRemain(remaining)}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
