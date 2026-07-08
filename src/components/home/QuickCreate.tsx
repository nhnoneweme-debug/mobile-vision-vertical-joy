import { Link } from "@tanstack/react-router";
import {
  Flame, CalendarPlus, Dumbbell, Utensils, Sparkles, ArrowRight, type LucideIcon,
} from "lucide-react";

type Tile = { label: string; icon: LucideIcon; hint: string };

const TILES: Tile[] = [
  { label: "Hábito", icon: Flame, hint: "Rotina que se repete" },
  { label: "Compromisso", icon: CalendarPlus, hint: "Evento com hora" },
  { label: "Treino", icon: Dumbbell, hint: "Plano de exercícios" },
  { label: "Plano alimentar", icon: Utensils, hint: "Cardápio guiado" },
];

function CreateTile({ tile }: { tile: Tile }) {
  const Icon = tile.icon;
  return (
    <Link
      to="/assistente"
      className="forge-card forge-press flex flex-col gap-2 rounded-2xl p-3.5 active:forge-press-active"
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-charcoal-900 text-ember">
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <span className="font-display text-base leading-tight tracking-wide text-foreground">
        {tile.label}
      </span>
      <span className="text-[11px] leading-tight text-muted-foreground">{tile.hint}</span>
    </Link>
  );
}

export function QuickCreate() {
  return (
    <section className="px-4 pt-5">
      <header className="mb-3 flex items-center gap-3">
        <h2 className="font-display text-xl tracking-[0.16em] text-foreground">CRIAR COM A IA</h2>
        <span className="h-px flex-1 bg-border" />
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        {TILES.map((t) => (
          <CreateTile key={t.label} tile={t} />
        ))}
      </div>

      <Link
        to="/assistente"
        className="forge-card forge-press mt-2.5 flex items-center gap-3 rounded-2xl p-3.5 active:forge-press-active"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-charcoal-900 text-ember">
          <Sparkles className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <span className="flex-1">
          <span className="block font-display text-base leading-tight tracking-wide text-foreground">
            Pedido personalizado
          </span>
          <span className="block text-[11px] leading-tight text-muted-foreground">
            Descreva em texto ou áudio — a IA monta e pede sua confirmação
          </span>
        </span>
        <ArrowRight className="h-4 w-4 text-ember" strokeWidth={2.4} />
      </Link>
    </section>
  );
}
