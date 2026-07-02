import { useEffect, useState } from "react";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { Sparkles, X, MessageCircle, ChevronRight } from "lucide-react";
import { getMentorTip } from "@/lib/mentor-tips";

/**
 * Bolha flutuante do Mentor — aparece em todas as telas autenticadas.
 * Mostra uma explicação contextual da rota atual e 3 perguntas sugeridas
 * que abrem a IA-Coletora (/ia) já com o texto preenchido.
 */
export function MentorBubble() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);

  // marca quando o usuário já abriu pela primeira vez (esconde o pulse)
  useEffect(() => {
    try {
      setSeen(localStorage.getItem("mentor.seen") === "1");
    } catch {}
  }, []);

  const tip = getMentorTip(pathname);

  function openSheet() {
    setOpen(true);
    if (!seen) {
      try {
        localStorage.setItem("mentor.seen", "1");
      } catch {}
      setSeen(true);
    }
  }

  function askIA(text: string) {
    try {
      sessionStorage.setItem("ia.seed", text);
    } catch {}
    setOpen(false);
    void navigate({ to: "/ia" });
  }

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onClick={openSheet}
        aria-label="Abrir Mentor"
        className="fixed right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-ember text-charcoal-900 shadow-lg shadow-ember/30 active:scale-95"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 88px)" }}
      >
        <Sparkles className="h-5 w-5" strokeWidth={2.4} />
        {!seen && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-ping rounded-full bg-ember/70" />
        )}
      </button>

      {/* Sheet */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto w-full max-w-[var(--shell-max)] rounded-t-3xl border-t border-border bg-card p-5"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-ember/15 text-ember">
                  <Sparkles className="h-4 w-4" strokeWidth={2.4} />
                </div>
                <div>
                  <p className="font-display text-[10px] tracking-[0.3em] text-ember">MENTOR</p>
                  <p className="font-display text-lg tracking-wide text-foreground">
                    {tip.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-foreground/85">{tip.blurb}</p>

            <div className="mt-4 space-y-2">
              <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
                PERGUNTAS RÁPIDAS
              </p>
              {tip.questions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => askIA(q)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left text-sm text-foreground active:scale-[0.99]"
                >
                  <span className="flex-1">{q}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void navigate({ to: "/ia" });
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-ember px-4 py-3 font-display text-sm tracking-[0.25em] text-charcoal-900 active:scale-[0.99]"
            >
              <MessageCircle className="h-4 w-4" />
              FALAR COM A IA
            </button>
          </div>
        </div>
      )}
    </>
  );
}
