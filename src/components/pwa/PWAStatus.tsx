import { useEffect, useState } from "react";
import { WifiOff, Download } from "lucide-react";
import { registerPWA } from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "personal-ia:install-dismissed";

export function PWAStatus() {
  const [offline, setOffline] = useState(false);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    registerPWA();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (localStorage.getItem(DISMISS_KEY)) return;
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  async function handleInstall() {
    if (!installEvt) return;
    await installEvt.prompt();
    await installEvt.userChoice.catch(() => null);
    setInstallEvt(null);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setInstallEvt(null);
  }

  return (
    <>
      {offline && (
        <div
          className="fixed inset-x-0 top-0 z-50 mx-auto flex w-full max-w-[480px] items-center justify-center gap-2 bg-charcoal-900/95 px-4 py-1.5 text-[11px] font-display tracking-[0.25em] text-ember backdrop-blur-md"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 4px)" }}
        >
          <WifiOff className="h-3.5 w-3.5" strokeWidth={2.4} />
          MODO OFFLINE
        </div>
      )}

      {installEvt && (
        <div
          className="fixed inset-x-0 top-0 z-40 mx-auto w-full max-w-[480px] px-3"
          style={{ paddingTop: `calc(env(safe-area-inset-top) + ${offline ? 28 : 6}px)` }}
        >
          <div className="flex items-center gap-2 rounded-xl border border-ember/30 bg-charcoal-900/95 px-3 py-2 shadow-lg backdrop-blur-xl">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ember/15 text-ember">
              <Download className="h-4 w-4" strokeWidth={2.2} />
            </div>
            <p className="flex-1 truncate font-display text-[11px] tracking-[0.18em] text-foreground">
              INSTALAR PERSONAL IA
            </p>
            <button
              onClick={dismiss}
              className="font-display text-[10px] tracking-[0.25em] text-muted-foreground"
            >
              DEPOIS
            </button>
            <button
              onClick={handleInstall}
              className="rounded-lg bg-ember px-2.5 py-1.5 font-display text-[10px] tracking-[0.18em] text-charcoal-950"
            >
              INSTALAR
            </button>
          </div>
        </div>
      )}

    </>
  );
}
