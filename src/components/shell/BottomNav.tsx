import { Link, useRouterState } from "@tanstack/react-router";
import {
  Map,
  CalendarDays,
  Sparkles,
  Flame,
  MoreHorizontal,
  User,
  ShoppingBag,
  Trophy,
  BookOpen,
  Users,
  LineChart,
  ClipboardCheck,
  Moon,
  Gem,
  Swords,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const UPPER_MENU: { section: string; items: NavItem[] }[] = [
  {
    section: "Jornada",
    items: [
      { to: "/progresso", label: "Progresso", icon: LineChart },
      { to: "/classe", label: "Classe & Perks", icon: Sparkles },
      { to: "/conquistas", label: "Conquistas & Lore", icon: Trophy },
      { to: "/cristais", label: "Cristais do Poder", icon: Gem },
      { to: "/ritual", label: "Rituais", icon: Moon },
    ],
  },
  {
    section: "Convívio",
    items: [
      { to: "/social", label: "Social", icon: Users },
      { to: "/desafios", label: "Desafios", icon: Swords },
      { to: "/painel", label: "Painel do Orientador", icon: ClipboardCheck },
      { to: "/area/orientador", label: "Falar com a IA", icon: BookOpen },
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

const ALL_UPPER_ITEMS = UPPER_MENU.flatMap((s) => s.items);

function NavSlot({
  to,
  label,
  Icon,
  active,
}: {
  to: string;
  label: string;
  Icon: LucideIcon;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-1 flex-col items-center gap-1 px-2 py-2 text-muted-foreground transition-colors"
      activeProps={{ className: "text-ember" }}
    >
      <Icon className="h-5 w-5" strokeWidth={2.2} />
      <span className="font-display text-[11px] tracking-[0.18em]">{label}</span>
      {active ? (
        <span className="absolute -top-[1px] h-[2px] w-8 rounded-full bg-ember shadow-[0_0_8px_var(--ember)]" />
      ) : null}
    </Link>
  );
}

export function BottomNav() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const upperMatch = ALL_UPPER_ITEMS.find((i) =>
    i.to === "/" ? pathname === "/" : pathname.startsWith(i.to),
  );
  const moreActive = Boolean(upperMatch);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] border-t border-border bg-charcoal-900/90 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="relative flex items-stretch justify-around px-2 pt-2">
        <li className="relative flex-1">
          <NavSlot to="/mapa" label="MAPA" Icon={Map} active={pathname.startsWith("/mapa") || pathname.startsWith("/area")} />
        </li>
        <li className="relative flex-1">
          <NavSlot to="/calendario" label="PLANO" Icon={CalendarDays} active={pathname.startsWith("/calendario")} />
        </li>

        {/* Centro destacado — IA */}
        <li className="relative flex-1">
          <Link
            to="/ia"
            className="group flex flex-col items-center gap-1 px-1 pt-1 text-muted-foreground"
            activeProps={{ className: "text-ember" }}
          >
            <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-ember text-charcoal-900 shadow-[0_8px_24px_-6px_var(--ember)] ring-4 ring-charcoal-900/90 transition-transform group-active:scale-95">
              <Sparkles className="h-6 w-6" strokeWidth={2.4} />
            </span>
            <span className="font-display text-[10px] tracking-[0.18em] text-foreground">
              IA
            </span>
          </Link>
        </li>

        <li className="relative flex-1">
          <NavSlot to="/habitos" label="HÁBITOS" Icon={Flame} active={pathname.startsWith("/habitos")} />
        </li>

        <li className="relative flex-1">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={
                  "flex w-full flex-col items-center gap-1 px-2 py-2 transition-colors " +
                  (moreActive ? "text-ember" : "text-muted-foreground")
                }
              >
                <MoreHorizontal className="h-5 w-5" strokeWidth={2.2} />
                <span className="font-display text-[11px] tracking-[0.18em] truncate max-w-[60px]">
                  {moreActive && upperMatch ? upperMatch.label.toUpperCase() : "MAIS"}
                </span>
              </button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="mx-auto max-w-[480px] rounded-t-2xl border-border bg-charcoal-900/95 backdrop-blur-xl"
            >
              <SheetHeader>
                <SheetTitle className="font-display tracking-[0.18em] text-foreground">
                  NAVEGAR
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-5 pb-6">
                {UPPER_MENU.map((section) => (
                  <div key={section.section}>
                    <p className="mb-2 font-display text-[11px] tracking-[0.22em] text-muted-foreground">
                      {section.section.toUpperCase()}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {section.items.map((item) => {
                        const active =
                          item.to === "/"
                            ? pathname === "/"
                            : pathname.startsWith(item.to);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setOpen(false)}
                            className={
                              "flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition-colors " +
                              (active
                                ? "border-ember/60 bg-ember/10 text-ember"
                                : "border-border/60 text-muted-foreground hover:text-foreground")
                            }
                          >
                            <Icon className="h-5 w-5" strokeWidth={2.2} />
                            <span className="font-display text-[10px] tracking-[0.15em]">
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
        </li>
      </ul>
    </nav>
  );
}
