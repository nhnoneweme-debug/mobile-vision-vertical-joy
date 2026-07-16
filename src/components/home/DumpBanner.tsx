import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sunrise, Moon, X, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getNotificationPrefs, syncTimezone } from "@/lib/ritual";
import { currentDumpWindow, dumpCopy, dumpDismissKey, type DumpWindow } from "@/lib/dump";

// Aparece na home dentro da janela de dump da pessoa (acordar → sonho,
// dormir → o dia). Some ao registrar ou ao dispensar, e não volta naquele dia.
export function DumpBanner() {
  const [window_, setWindow_] = useState<DumpWindow | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;
      let w: DumpWindow | null = null;
      try {
        const prefs = await getNotificationPrefs(data.user.id);
        // O push das janelas sai do servidor: ele precisa do fuso de quem abriu.
        void syncTimezone(data.user.id, prefs.timezone);
        w = currentDumpWindow(prefs);
      } catch {
        return; // sem prefs, não arrisca banner errado
      }
      if (!w || cancelled) return;

      // Já dispensou hoje?
      if (localStorage.getItem(dumpDismissKey(w)) === "1") return;

      // Já registrou o ritual desse dia? Então não cobra de novo.
      const { data: done } = await supabase
        .from("ritual_logs")
        .select("id")
        .eq("user_id", data.user.id)
        .eq("ritual_date", w.refDate)
        .eq("ritual_type", w.type)
        .maybeSingle();
      if (done || cancelled) return;

      setWindow_(w);
      setDismissed(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!window_ || dismissed) return null;

  const copy = dumpCopy(window_.type);
  const isMorning = window_.type === "morning";
  const Icon = isMorning ? Sunrise : Moon;

  function dismiss() {
    if (window_) localStorage.setItem(dumpDismissKey(window_), "1");
    setDismissed(true);
  }

  return (
    <div className="px-4 pt-3">
      <div
        className={
          "relative flex items-center gap-3 rounded-2xl border p-3 " +
          (isMorning
            ? "border-amber-400/40 bg-amber-400/10"
            : "border-indigo-400/40 bg-indigo-500/10")
        }
      >
        <span
          className={
            "grid h-10 w-10 shrink-0 place-items-center rounded-full text-charcoal-900 " +
            (isMorning ? "bg-amber-400" : "bg-indigo-400")
          }
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm tracking-wide text-foreground">{copy.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">{copy.sub}</p>
        </div>
        <Link
          to={copy.to}
          className={
            "flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 font-display text-[10px] tracking-[0.15em] text-charcoal-900 " +
            (isMorning ? "bg-amber-400" : "bg-indigo-400")
          }
        >
          {copy.cta}
          <ChevronRight className="h-3 w-3" />
        </Link>
        <button
          onClick={dismiss}
          aria-label="Dispensar por hoje"
          className="absolute right-1 top-1 grid h-6 w-6 place-items-center text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
