import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import type { Area } from "./areas";
import { cn } from "@/lib/utils";

const colSpanClass: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
};
const rowSpanClass: Record<number, string> = {
  1: "row-span-1",
  2: "row-span-2",
};

export function BentoArea({
  area,
  level,
  xpPct,
}: {
  area: Area;
  level?: number;
  xpPct?: number;
}) {
  const Icon = area.icon;
  const locked = area.status === "bloqueado";
  const showLevel = !locked && typeof level === "number" && level > 0;


  const content = (
    <>
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
            locked ? "bg-charcoal-900 text-locked" : "bg-charcoal-900 text-ember",
          )}
        >
          {locked ? (
            <Lock className="h-4 w-4" strokeWidth={2.4} />
          ) : (
            <Icon className="h-5 w-5" strokeWidth={2.2} />
          )}
        </div>
        {showLevel ? (
          <span className="rounded-md bg-ember/15 px-1.5 py-0.5 font-display text-[9px] tracking-[0.2em] text-ember">
            NV {level}
          </span>
        ) : area.status === "ativo" ? (
          <span className="rounded-md bg-ember/15 px-1.5 py-0.5 font-display text-[9px] tracking-[0.2em] text-ember">
            ATIVO
          </span>
        ) : null}

      </div>

      <div className="mt-auto">
        <h3
          className={cn(
            "font-display text-xl leading-none tracking-wide",
            locked ? "text-locked" : "text-foreground",
          )}
        >
          {area.name}
        </h3>
        <p
          className={cn(
            "mt-1 font-display text-[10px] tracking-[0.22em]",
            locked ? "text-locked" : "text-muted-foreground",
          )}
        >
          {area.tagline.toUpperCase()}
        </p>
        {showLevel && typeof xpPct === "number" && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-charcoal-800">
            <div className="h-full bg-ember" style={{ width: `${xpPct}%` }} />
          </div>
        )}
      </div>

    </>
  );

  const className = cn(
    "flex min-h-[120px] flex-col rounded-2xl border border-border bg-card p-3 transition-transform",
    colSpanClass[area.colSpan],
    rowSpanClass[area.rowSpan],
    locked ? "opacity-60" : "active:scale-[0.98] hover:border-ember/40",
  );

  if (locked) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link to="/area/$slug" params={{ slug: area.slug }} className={className}>
      {content}
    </Link>
  );
}
