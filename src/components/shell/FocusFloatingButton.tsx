import { Coffee } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { useWakeLockContext } from "@/providers/WakeLockProvider";

// Micro-botão flutuante do modo foco (Wake Lock). Aparece SEMPRE que a barra
// inferior está oculta (rotas imersivas /assistente e /conversar) e também
// quando o lock está ativo em qualquer rota — assim o usuário nunca perde
// acesso ao toggle e vê feedback claro do estado.
//
// Posiciona no canto inferior direito, acima da safe-area, sem sobrepor o
// composer central do chat (que ocupa o meio da tela).
export function FocusFloatingButton() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const wake = useWakeLockContext();

  if (!wake.supported) return null;

  const onImmersive =
    pathname.startsWith("/assistente") || pathname.startsWith("/conversar");

  // Não polui a UI: só aparece quando a barra inferior sumiu (rotas imersivas)
  // ou quando o modo foco está ativo (feedback de estado + toggle rápido).
  if (!onImmersive && !wake.active) return null;

  return (
    <button
      type="button"
      onClick={() => void wake.toggle()}
      aria-label={wake.active ? "Liberar tela (desligar modo foco)" : "Manter tela acesa (modo foco)"}
      aria-pressed={wake.active}
      title={wake.active ? "Modo foco ativo — tela sempre acesa" : "Manter tela acesa"}
      className={
        "fixed right-3 z-50 grid h-11 w-11 place-items-center rounded-full border border-border shadow-lg backdrop-blur-xl transition-all active:scale-95 " +
        (wake.active
          ? "bg-ember text-charcoal-900 shadow-ember/40"
          : "bg-charcoal-900/85 text-muted-foreground hover:text-foreground")
      }
      style={{ bottom: `calc(env(safe-area-inset-bottom) + 88px)` }}
    >
      <Coffee className="h-5 w-5" strokeWidth={2.2} />
      {wake.active && (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-ember shadow-[0_0_8px] shadow-ember ring-2 ring-background" />
      )}
    </button>
  );
}
