import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { countUnread, generateMyNudges } from "@/lib/notifications";
import { ProfileMenu } from "./ProfileMenu";

// Barra inferior única do app: Notificações (esq.) · IA em destaque (centro) ·
// Perfil + Configurações (dir.). Substitui as peças soltas que existiam antes
// (NotificationsBell fixo + AiOrb flutuante) e concentra a navegação no drawer
// do ProfileMenu.
export function AppBottomBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [displayName, setDisplayName] = useState("Você");
  const [unread, setUnread] = useState(0);

  // Nome do usuário para o avatar do perfil (uma vez).
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

  // Contagem de não-lidas — recontar ao mudar de rota (garante refresh após ler).
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
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const onIaRoute = pathname.startsWith("/assistente") || pathname.startsWith("/conversar");
  const onNotifRoute = pathname.startsWith("/notificacoes");

  // Telas de chat imersivo (assistente/conversar) têm composer próprio fixo no
  // rodapé — esconde a barra pra não sobrepor. O BackButton (topo) permite sair.
  if (onIaRoute) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[var(--shell-max)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative mx-3 mb-3 flex items-center justify-between rounded-2xl border border-border bg-charcoal-900/90 px-6 py-2.5 backdrop-blur-xl">
        {/* Esquerda — Notificações */}
        <Link
          to="/notificacoes"
          aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ""}`}
          className={
            "relative grid h-12 w-12 place-items-center rounded-2xl transition-colors active:scale-95 " +
            (onNotifRoute ? "text-ember" : "text-muted-foreground hover:text-foreground")
          }
        >
          <Bell className="h-6 w-6" strokeWidth={2.2} />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 font-display text-[9px] font-bold text-charcoal-900">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>

        {/* Centro — IA em destaque (elevado, sobreposto ao topo da barra) */}
        <Link
          to="/assistente"
          aria-label="Abrir a Inteligência Digital"
          className={
            "absolute -top-6 left-1/2 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-ember text-charcoal-900 forge-raised ring-4 ring-background transition-transform active:scale-95 " +
            (onIaRoute ? "ember-pulse" : "")
          }
        >
          <Sparkles className="h-7 w-7" strokeWidth={2.4} />
        </Link>

        {/* Direita — Perfil + Configurações (drawer com toda a navegação) */}
        <ProfileMenu displayName={displayName} />
      </div>
    </nav>
  );
}
