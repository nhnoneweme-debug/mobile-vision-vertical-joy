import { Link } from "@tanstack/react-router";
import { Dumbbell, Utensils, ArrowRight } from "lucide-react";

// Substitui o antigo "Criar com IA": atalhos para as áreas de acompanhamento
// dedicado (Treino e Plano Alimentar), cada uma com sua própria página.
export function TrackingShortcuts() {
  return (
    <section className="px-4 pt-5">
      <header className="mb-3 flex items-center gap-3">
        <h2 className="font-display text-xl tracking-[0.16em] text-foreground">ACOMPANHAMENTO</h2>
        <span className="h-px flex-1 bg-border" />
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        <Link
          to="/treino"
          className="forge-card forge-press flex flex-col gap-2 rounded-2xl p-4 active:forge-press-active"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-charcoal-900 text-ember">
            <Dumbbell className="h-6 w-6" strokeWidth={2.2} />
          </span>
          <span className="font-display text-lg leading-tight tracking-wide text-foreground">Treino</span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            Plano e registro <ArrowRight className="h-3 w-3" />
          </span>
        </Link>

        <Link
          to="/plano-alimentar"
          className="forge-card forge-press flex flex-col gap-2 rounded-2xl p-4 active:forge-press-active"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-charcoal-900 text-ember">
            <Utensils className="h-6 w-6" strokeWidth={2.2} />
          </span>
          <span className="font-display text-lg leading-tight tracking-wide text-foreground">Plano alimentar</span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            Refeições e água <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      </div>
    </section>
  );
}
