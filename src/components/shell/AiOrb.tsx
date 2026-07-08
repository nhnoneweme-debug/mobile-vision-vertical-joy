import { Link, useRouterState } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

// Único botão da Inteligência Digital — flutuante, centralizado embaixo.
// Substitui a barra de navegação inferior.
export function AiOrb() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/assistente")) return null;

  return (
    <Link
      to="/assistente"
      aria-label="Abrir a Inteligência Digital"
      className="fixed bottom-6 left-1/2 z-40 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-full bg-ember text-charcoal-900 forge-raised ember-pulse active:scale-95"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <Sparkles className="h-7 w-7" strokeWidth={2.4} />
    </Link>
  );
}
