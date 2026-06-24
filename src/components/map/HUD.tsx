import { Flame } from "lucide-react";

export function HUD({
  displayName,
  behavioralClass,
  level,
  xp,
  xpToNext,
  streak,
}: {
  displayName: string;
  behavioralClass: string;
  level: number;
  xp: number;
  xpToNext: number;
  streak: number;
}) {
  const pct = Math.min(100, Math.round((xp / xpToNext) * 100));

  return (
    <section
      className="sticky top-0 z-30 border-b border-border bg-charcoal-900/85 px-4 pb-4 pt-5 backdrop-blur-xl"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <div className="ember-glow grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-charcoal-800">
          <span className="font-display text-xl text-ember">
            {displayName.slice(0, 1).toUpperCase()}
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-display text-2xl leading-none tracking-wide text-foreground">
              {displayName}
            </h2>
            <span className="rounded-md border border-border bg-charcoal-800 px-1.5 py-0.5 font-display text-[10px] uppercase tracking-[0.2em] text-ember">
              {behavioralClass}
            </span>
          </div>
          <p className="mt-1 font-display text-[11px] tracking-[0.25em] text-muted-foreground">
            NÍVEL {String(level).padStart(2, "0")} · {xp}/{xpToNext} XP
          </p>
        </div>

        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1 rounded-lg bg-charcoal-800 px-2 py-1">
            <Flame className="h-4 w-4 text-ember ember-pulse rounded-full" strokeWidth={2.5} />
            <span className="font-display text-base leading-none text-foreground">
              {streak}
            </span>
          </div>
          <span className="mt-1 font-display text-[9px] tracking-[0.25em] text-muted-foreground">
            STREAK
          </span>
        </div>
      </div>

      {/* XP bar */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-charcoal-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-ember to-ember-glow transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}
