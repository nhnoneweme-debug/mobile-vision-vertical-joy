import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { countUnread, generateMyNudges } from "@/lib/notifications";

export function NotificationsBell() {
  const [unread, setUnread] = useState(0);
  const { pathname } = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;
      try {
        await generateMyNudges();
      } catch {
        /* silencioso */
      }
      try {
        const n = await countUnread(data.user.id);
        if (!cancelled) setUnread(n);
      } catch {
        /* silencioso */
      }
    })();
    return () => { cancelled = true; };
    // Recontar ao mudar de rota (garante refresh após ler)
  }, [pathname]);

  return (
    <Link
      to="/notificacoes"
      aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ""}`}
      className="fixed right-3 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-charcoal-900/80 text-foreground backdrop-blur-md active:scale-95"
      style={{ top: "calc(env(safe-area-inset-top) + 0.5rem)" }}
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 font-display text-[9px] font-bold text-charcoal-900">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
