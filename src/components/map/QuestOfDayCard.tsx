import { Link } from "@tanstack/react-router";
import { ArrowRight, Zap } from "lucide-react";

export function QuestOfDayCard() {
  return (
    <Link
      to="/area/$slug"
      params={{ slug: "treino" }}
      className="ember-glow group block rounded-2xl border border-ember/30 bg-gradient-to-br from-charcoal-800 to-charcoal-900 p-4 transition-transform active:scale-[0.99]"
    >
      <div className="flex items-center gap-2">
        <span className="font-display text-[10px] tracking-[0.3em] text-ember">
          QUEST DO DIA
        </span>
        <span className="h-px flex-1 bg-border" />
        <span className="flex items-center gap-1 font-display text-[11px] tracking-[0.2em] text-foreground">
          <Zap className="h-3 w-3 text-ember" strokeWidth={2.5} />
          +100 XP
        </span>
      </div>

      <h3 className="mt-2 font-display text-3xl leading-none tracking-wide text-foreground">
        Acender o Corpo
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Complete o treino recomendado para hoje. Sem energia? Versão leve liberada.
      </p>

      <div className="mt-3 flex items-center justify-between">
        <span className="font-display text-xs tracking-[0.2em] text-muted-foreground">
          ÁREA DE TREINO
        </span>
        <span className="flex items-center gap-1 font-display text-sm tracking-wider text-ember">
          ENTRAR <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </span>
      </div>
    </Link>
  );
}
