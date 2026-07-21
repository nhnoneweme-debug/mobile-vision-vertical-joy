// Faixa "AGORA / A SEGUIR" — usada dentro do /assistente logo abaixo do header.
// Mostra o bloco em execução (com progresso) e o próximo (com contagem).
// Se não há nada em andamento nem próximo, não renderiza.

import { ArrowRight, Clock, Sparkles } from "lucide-react";
import type { ActiveJourney } from "@/hooks/useActiveJourney";

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function humanRemain(min: number): string {
  if (min <= 0) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h}h${String(rest).padStart(2, "0")}` : `${h}h`;
}

export function JourneyStrip({ journey }: { journey: ActiveJourney }) {
  const { current, next, progressPct, minutesToEndOfCurrent, minutesToStartOfNext } = journey;
  if (!current && !next) return null;

  return (
    <div className="border-b border-border/60 bg-charcoal-900/70 px-4 py-2 backdrop-blur-xl">
      <div className="flex items-stretch gap-2">
        {/* AGORA */}
        <div className="min-w-0 flex-1 rounded-xl border border-ember/40 bg-ember/5 px-3 py-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 font-display text-[9px] tracking-[0.18em] text-ember">
              <Sparkles className="h-3 w-3" /> AGORA
            </span>
            {minutesToEndOfCurrent != null ? (
              <span className="font-display text-[10px] tracking-[0.12em] text-ember/80">
                termina em {humanRemain(minutesToEndOfCurrent)}
              </span>
            ) : null}
          </div>
          {current ? (
            <>
              <p className="truncate text-[13px] leading-tight text-foreground">{current.title}</p>
              <p className="mt-0.5 font-display text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                {fmt(current.startMin)}–{fmt(current.endMin)}
              </p>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-charcoal-800">
                <div
                  className="h-full bg-ember transition-[width] duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-[12px] italic text-muted-foreground">nada em execução agora</p>
          )}
        </div>

        {/* A SEGUIR */}
        <div className="min-w-0 flex-1 rounded-xl border border-border bg-charcoal-800/40 px-3 py-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 font-display text-[9px] tracking-[0.18em] text-muted-foreground">
              <ArrowRight className="h-3 w-3" /> A SEGUIR
            </span>
            {minutesToStartOfNext != null ? (
              <span className="inline-flex items-center gap-1 font-display text-[10px] tracking-[0.12em] text-muted-foreground">
                <Clock className="h-3 w-3" /> em {humanRemain(minutesToStartOfNext)}
              </span>
            ) : null}
          </div>
          {next ? (
            <>
              <p className="truncate text-[13px] leading-tight text-foreground">{next.title}</p>
              <p className="mt-0.5 font-display text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                {fmt(next.startMin)}
                {next.endMin ? `–${fmt(next.endMin)}` : ""}
              </p>
            </>
          ) : (
            <p className="text-[12px] italic text-muted-foreground">livre depois disso</p>
          )}
        </div>
      </div>
    </div>
  );
}
