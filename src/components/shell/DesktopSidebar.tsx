import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  Dumbbell,
  Home,
  ListChecks,
  Map,
  Sparkles,
  Target,
  Trophy,
  Utensils,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { countUnread } from "@/lib/notifications";

const NAV = [
  { to: "/home" as const, label: "Home", icon: Home },
  { to: "/treino" as const, label: "Treino", icon: Dumbbell },
  { to: "/plano-alimentar" as const, label: "Dieta", icon: Utensils },
  { to: "/missoes" as const, label: "Missões", icon: ListChecks },
  { to: "/agenda" as const, label: "Agenda", icon: CalendarDays },
  { to: "/mapa" as const, label: "Mapa", icon: Map },
  { to: "/conquistas" as const, label: "Conquistas", icon: Trophy },
  { to: "/calendario" as const, label: "Metas", icon: Target },
];

export function DesktopSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [displayName, setDisplayName] = useState("Você");
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!cancelled && profile?.display_name) setDisplayName(profile.display_name);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;
      try {
        const n = await countUnread(data.user.id);
        if (!cancelled) setUnread(n);
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <aside className="hidden h-[100dvh] w-[var(--sidebar-width)] shrink-0 flex-col border-r border-border bg-charcoal-900 lg:flex">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-ember text-charcoal-900">
          <Sparkles className="h-5 w-5" strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm tracking-[0.18em] text-foreground">
            PERSONAL IA
          </p>
          <p className="truncate text-[10px] text-muted-foreground">{displayName}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {NAV.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={
                "mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors " +
                (active
                  ? "bg-ember/10 text-ember"
                  : "text-muted-foreground hover:bg-charcoal-800 hover:text-foreground")
              }
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2.2} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <Link
          to="/assistente"
          className={
            "mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors " +
            (pathname.startsWith("/assistente") || pathname.startsWith("/conversar")
              ? "bg-ember text-charcoal-900"
              : "bg-ember/10 text-ember hover:bg-ember/20")
          }
        >
          <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2.4} />
          <span className="flex-1 font-display tracking-[0.12em]">IA DIGITAL</span>
        </Link>
        <Link
          to="/notificacoes"
          className={
            "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors " +
            (pathname.startsWith("/notificacoes")
              ? "text-ember"
              : "text-muted-foreground hover:bg-charcoal-800 hover:text-foreground")
          }
        >
          <Bell className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          <span>Notificações</span>
          {unread > 0 && (
            <span className="ml-auto rounded-full bg-ember px-1.5 py-0.5 font-display text-[9px] text-charcoal-900">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </div>
    </aside>
  );
}
