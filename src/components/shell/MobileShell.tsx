import { useEffect, type ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { getInclusionPrefs } from "@/lib/area-extra";

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
  hideMentor: _hideMentor = false, // kept for API compat; mentor moved into BottomNav
}: {
  children: ReactNode;
  hideNav?: boolean;
  hideMentor?: boolean;
}) {
  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;
        const prefs = await getInclusionPrefs(data.user.id);
        applyAccessibilityFromPrefs(prefs);
      } catch {
        /* silencioso — preferências opcionais */
      }
    })();
  }, []);

  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-background">
      <main
        className="flex-1 pb-28"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
