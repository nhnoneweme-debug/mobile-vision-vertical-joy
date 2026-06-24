import { Link } from "@tanstack/react-router";
import { Map, Swords, Sparkles, User } from "lucide-react";

const items = [
  { to: "/mapa", label: "Mapa", icon: Map },
  { to: "/area/$slug", params: { slug: "missoes" }, label: "Missões", icon: Swords },
  { to: "/area/$slug", params: { slug: "coach" }, label: "Coach", icon: Sparkles },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] border-t border-border bg-charcoal-900/90 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around px-2 pt-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.label} className="flex-1">
              <Link
                // @ts-expect-error TanStack typed routes — runtime handles both shapes
                to={item.to}
                // @ts-expect-error see above
                params={item.params}
                className="group flex flex-col items-center gap-1 px-2 py-2 text-muted-foreground transition-colors"
                activeProps={{ className: "text-ember" }}
              >
                <Icon className="h-5 w-5" strokeWidth={2.2} />
                <span className="font-display text-[11px] tracking-[0.18em]">
                  {item.label.toUpperCase()}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
