import {  } from "@tanstack/react-router";
import type { Area } from "@/components/map/areas";
import { areaLevelProgress } from "@/lib/area-missions";

type Props = {
  area: Area;
  xp: number;
};

export function AreaHeader({ area, xp }: Props) {
  const Icon = area.icon;
  const { level, intoLevel, pct } = areaLevelProgress(xp);

  return (
    <header
      className="sticky top-0 z-30 border-b border-border bg-charcoal-900/85 px-4 pb-4 backdrop-blur-xl"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] tracking-[0.3em] text-ember">
            ÁREA · {area.tagline.toUpperCase()}
          </p>
          <h1 className="truncate font-display text-2xl leading-none tracking-wide text-foreground">
            {area.name}
          </h1>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-charcoal-800 text-ember">
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-charcoal-900/60 p-3">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[10px] tracking-[0.22em] text-muted-foreground">
            NÍVEL DA ÁREA
          </span>
          <span className="font-display text-2xl leading-none tracking-wide text-foreground">
            {level}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-charcoal-800">
          <div className="h-full bg-ember transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 font-display text-[10px] tracking-[0.18em] text-muted-foreground">
          {intoLevel} / 200 XP PARA NÍVEL {level + 1}
        </p>
      </div>
    </header>
  );
}
