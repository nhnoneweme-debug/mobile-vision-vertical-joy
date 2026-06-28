import { Link } from "@tanstack/react-router";
import { Map, Swords, Flame, ShoppingBag, User } from "lucide-react";

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] border-t border-border bg-charcoal-900/90 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around px-2 pt-2">
        <li className="flex-1">
          <Link
            to="/mapa"
            className="group flex flex-col items-center gap-1 px-2 py-2 text-muted-foreground transition-colors"
            activeProps={{ className: "text-ember" }}
          >
            <Map className="h-5 w-5" strokeWidth={2.2} />
            <span className="font-display text-[11px] tracking-[0.18em]">MAPA</span>
          </Link>
        </li>
        <li className="flex-1">
          <Link
            to="/area/$slug"
            params={{ slug: "missoes" }}
            className="group flex flex-col items-center gap-1 px-2 py-2 text-muted-foreground transition-colors"
            activeProps={{ className: "text-ember" }}
          >
            <Swords className="h-5 w-5" strokeWidth={2.2} />
            <span className="font-display text-[11px] tracking-[0.18em]">MISSÕES</span>
          </Link>
        </li>
        <li className="flex-1">
          <Link
            to="/habitos"
            className="group flex flex-col items-center gap-1 px-2 py-2 text-muted-foreground transition-colors"
            activeProps={{ className: "text-ember" }}
          >
            <Flame className="h-5 w-5" strokeWidth={2.2} />
            <span className="font-display text-[11px] tracking-[0.18em]">HÁBITOS</span>
          </Link>
        </li>
        <li className="flex-1">
          <Link
            to="/loja"
            className="group flex flex-col items-center gap-1 px-2 py-2 text-muted-foreground transition-colors"
            activeProps={{ className: "text-ember" }}
          >
            <ShoppingBag className="h-5 w-5" strokeWidth={2.2} />
            <span className="font-display text-[11px] tracking-[0.18em]">LOJA</span>
          </Link>
        </li>
        <li className="flex-1">
          <Link
            to="/perfil"
            className="group flex flex-col items-center gap-1 px-2 py-2 text-muted-foreground transition-colors"
            activeProps={{ className: "text-ember" }}
          >
            <User className="h-5 w-5" strokeWidth={2.2} />
            <span className="font-display text-[11px] tracking-[0.18em]">PERFIL</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
