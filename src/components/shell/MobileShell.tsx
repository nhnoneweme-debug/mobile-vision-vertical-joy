import { useEffect, useState, type ReactNode } from "react";
import { AppBottomBar } from "./AppBottomBar";
import { DesktopSidebar } from "./DesktopSidebar";
import { FocusFloatingButton } from "./FocusFloatingButton";
import { supabase } from "@/integrations/supabase/client";
import { getInclusionPrefs } from "@/lib/area-extra";
import { useWakeAlarmScheduler } from "@/hooks/useWakeAlarmScheduler";
import { WakeLockProvider } from "@/providers/WakeLockProvider";

let bootstrapped = false;

function applyAccessibilityFromPrefs(prefs: {
  accessibility: { reduced_motion: boolean; large_text: boolean; high_contrast: boolean };
}) {
  const html = document.documentElement;
  html.classList.toggle("reduce-motion", prefs.accessibility.reduced_motion);
  html.classList.toggle("large-text", prefs.accessibility.large_text);
  html.classList.toggle("high-contrast", prefs.accessibility.high_contrast);
}

export function MobileShell({
  children,
  hideNav = false,
  hideMentor: _hideMentor = false, // kept for API compat; nav consolidada na AppBottomBar
}: {
  children: ReactNode;
  hideNav?: boolean;
  hideMentor?: boolean;
}) {
  const [hasUser, setHasUser] = useState(false);

  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;
        setHasUser(true);
        const prefs = await getInclusionPrefs(data.user.id);
        applyAccessibilityFromPrefs(prefs);
      } catch {
        /* silencioso — preferências opcionais */
      }
    })();
    // Also flip hasUser when session becomes available later.
    supabase.auth.getUser().then(({ data }) => setHasUser(!!data.user)).catch(() => {});
  }, []);

  useWakeAlarmScheduler(hasUser && !hideNav);

  return (
    <div className="relative flex min-h-[100dvh] w-full bg-background">
      {/* Sidebar visível apenas em desktop (≥1024px), oculta por padrão */}
      {!hideNav && <DesktopSidebar />}

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[var(--shell-max)] flex-1 flex-col">
        <main className="flex-1 pb-28 lg:pb-8" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          {children}
        </main>
        {!hideNav && <AppBottomBar />}
      </div>
    </div>
  );
}
