import { createContext, useContext, type ReactNode } from "react";
import { useWakeLock } from "@/hooks/useWakeLock";

// Contexto global do Wake Lock — precisa viver acima das rotas pra que o lock
// não seja liberado ao navegar entre telas (o hook `useWakeLock` faz `release`
// no unmount). Antes ficava dentro do `AppBottomBar`, que desmonta em rotas
// imersivas (/assistente, /conversar) — a tela apagava assim que o usuário
// entrava no chat. Aqui o provider é montado uma única vez no MobileShell e
// segue vivo entre rotas.

type Ctx = ReturnType<typeof useWakeLock>;

const WakeLockContext = createContext<Ctx | null>(null);

export function WakeLockProvider({ children }: { children: ReactNode }) {
  const wake = useWakeLock();
  return <WakeLockContext.Provider value={wake}>{children}</WakeLockContext.Provider>;
}

export function useWakeLockContext(): Ctx {
  const ctx = useContext(WakeLockContext);
  if (!ctx) {
    // Fallback defensivo — se algum componente for renderizado fora do
    // MobileShell (ex.: rota de auth), evita crash retornando um estado inerte.
    return {
      active: false,
      supported: false,
      toggle: async () => {},
    };
  }
  return ctx;
}
