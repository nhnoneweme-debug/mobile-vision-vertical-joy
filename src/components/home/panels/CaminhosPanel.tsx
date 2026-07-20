import { Link } from "@tanstack/react-router";
import {
  Compass,
  ListChecks,
  Sparkles,
  Moon,
  CalendarDays,
  Users2,
  type LucideIcon,
} from "lucide-react";

type PathTile = {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  to?: string;
  search?: Record<string, string>;
  onSelect?: () => void;
};

export function CaminhosPanel({ onOpenAgenda }: { onOpenAgenda: () => void }) {
  const tiles: PathTile[] = [
    {
      key: "planejar",
      label: "Planejar",
      hint: "Estruture metas com a WiMi",
      icon: Compass,
      to: "/assistente",
      search: { seed: "planejar" },
    },
    {
      key: "executar",
      label: "Executar",
      hint: "Kanban do dia com a WiMi",
      icon: ListChecks,
      to: "/executar",
    },
    {
      key: "refletir",
      label: "Refletir",
      hint: "Diário, sonhos e sentido",
      icon: Sparkles,
      to: "/mental",
    },
    {
      key: "descansar",
      label: "Descansar",
      hint: "Sono, rituais e pausas",
      icon: Moon,
      to: "/dormir",
    },
    {
      key: "agenda",
      label: "Agenda",
      hint: "Seu mês em um olhar",
      icon: CalendarDays,
      onSelect: onOpenAgenda,
    },
    {
      key: "grupos",
      label: "Grupos",
      hint: "Família, amigos e círculos",
      icon: Users2,
      to: "/circulo",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {tiles.map((t) => {
        const Icon = t.icon;
        const inner = (
          <>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-charcoal-900 text-ember">
              <Icon className="h-6 w-6" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 font-display text-lg leading-tight tracking-wide text-foreground">
              {t.label}
            </span>
            <span className="min-w-0 text-[11px] leading-tight text-muted-foreground">
              {t.hint}
            </span>
          </>
        );

        if (t.onSelect) {
          return (
            <button
              key={t.key}
              type="button"
              onClick={t.onSelect}
              className="forge-card forge-press flex flex-col gap-2 rounded-2xl p-4 text-left active:forge-press-active"
            >
              {inner}
            </button>
          );
        }
        return (
          <Link
            key={t.key}
            to={t.to!}
            search={t.search as never}
            className="forge-card forge-press flex flex-col gap-2 rounded-2xl p-4 active:forge-press-active"
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
