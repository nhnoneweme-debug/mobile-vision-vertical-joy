import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  User,
  ShoppingBag,
  Trophy,
  Users,
  LineChart,
  ClipboardCheck,
  Moon,
  Sunrise,
  Swords,
  Wand2,
  MapPin,
  MessageCircle,
  ChevronUp,
  CalendarDays,
  Flame,
  Dumbbell,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type NavItem = { to: string; label: string; icon: LucideIcon };

// Itens antes no menu "MAIS" da barra inferior — agora acessíveis pela bolinha do perfil.
const MENU: { section: string; items: NavItem[] }[] = [
  {
    section: "Navegar",
    items: [
      { to: "/agenda", label: "Agenda", icon: CalendarDays },
      { to: "/habitos", label: "Hábitos", icon: Flame },
      { to: "/treino", label: "Treino", icon: Dumbbell },
      { to: "/plano-alimentar", label: "Plano Alimentar", icon: Utensils },
      { to: "/calendario", label: "Plano & Metas", icon: CalendarDays },
    ],
  },
  {
    section: "Jornada",
    items: [
      { to: "/progresso", label: "Progresso", icon: LineChart },
      { to: "/missoes", label: "Minhas Missões", icon: ClipboardCheck },
      { to: "/conquistas", label: "Conquistas & Saga", icon: Trophy },
      { to: "/despertar", label: "Despertar (Dump do sonho)", icon: Sunrise },
      { to: "/dormir", label: "Dormir (Dump do dia)", icon: Moon },
      { to: "/jornada", label: "Jornada do Dia", icon: MapPin },
      { to: "/ritual", label: "Rituais", icon: Moon },
    ],
  },
  {
    section: "Convívio",
    items: [
      { to: "/circulo", label: "Círculo", icon: Users },
      { to: "/social", label: "Social", icon: Users },
      { to: "/desafios", label: "Desafios", icon: Swords },
      { to: "/conversar", label: "Conversar (IA)", icon: MessageCircle },
    ],
  },
  {
    section: "Conta",
    items: [
      { to: "/perfil", label: "Perfil", icon: User },
      { to: "/loja", label: "Forja de Brasas", icon: ShoppingBag },
      { to: "/studio", label: "Studio (admin)", icon: Wand2 },
    ],
  },
];

export function ProfileMenu({
  displayName,
  variant = "orb",
}: {
  displayName: string;
  /** "orb": bolinha da barra inferior (mobile). "row": linha da sidebar (desktop). */
  variant?: "orb" | "row";
}) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {variant === "row" ? (
          <button
            type="button"
            aria-label="Menu do perfil"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-charcoal-800 hover:text-foreground"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-charcoal-800 font-display text-sm text-ember">
              {initial}
            </span>
            <span className="min-w-0 flex-1 truncate text-left">{displayName}</span>
            <ChevronUp className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Menu do perfil"
            className="ember-glow grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-charcoal-800 active:scale-95"
          >
            <span className="font-display text-xl text-ember">{initial}</span>
          </button>
        )}
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[85vh] max-w-[var(--shell-max)] flex-col rounded-t-2xl border-border bg-charcoal-900/95 backdrop-blur-xl"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 font-display tracking-[0.18em] text-foreground">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-ember/15 font-display text-ember">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
            {displayName.toUpperCase()}
          </SheetTitle>
        </SheetHeader>

        <div
          className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pb-6"
          data-lenis-prevent
        >
          {MENU.map((section) => (
            <div key={section.section}>
              <p className="mb-2 font-display text-[11px] tracking-[0.22em] text-muted-foreground">
                {section.section.toUpperCase()}
              </p>
              <div className="flex flex-col gap-1.5">
                {section.items.map((item) => {
                  const active = pathname.startsWith(item.to);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={
                        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors " +
                        (active
                          ? "border-ember/60 bg-ember/10 text-ember"
                          : "border-border/60 text-foreground/90")
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={2.2} />
                      <span className="min-w-0 flex-1 truncate font-display text-[13px] tracking-[0.14em]">
                        {item.label.toUpperCase()}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
