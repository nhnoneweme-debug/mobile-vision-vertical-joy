import { useRouter, useRouterState } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

// Botão de voltar global — aparece em todas as telas com shell, exceto a Home
// (e telas de entrada). Alinhado ao topo-esquerdo do shell.
const HIDE_ON = ["/home", "/onboarding"];

export function BackButton() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (HIDE_ON.some((p) => pathname === p || pathname.startsWith(p))) return null;

  function goBack() {
    try {
      if (window.history.length > 1) {
        router.history.back();
        return;
      }
    } catch {
      /* fallback abaixo */
    }
    router.navigate({ to: "/home" });
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 mx-auto w-full max-w-[var(--shell-max)]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <button
        type="button"
        onClick={goBack}
        aria-label="Voltar"
        className="pointer-events-auto m-2 grid h-9 w-9 place-items-center rounded-full border border-border bg-charcoal-900/85 text-foreground backdrop-blur active:scale-95"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
      </button>
    </div>
  );
}
