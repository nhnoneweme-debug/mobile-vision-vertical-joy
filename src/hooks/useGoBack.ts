import { useCallback } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";

// Telas que são início de fluxo: não há "página anterior" pra onde voltar.
// (o onboarding tem o próprio voltar, que anda entre etapas — não entre rotas)
const NO_BACK = ["/home", "/onboarding"];

/**
 * Voltar único do app: sempre para a página anterior.
 *
 * Existe um só por viewport — barra inferior no mobile, barra lateral no
 * desktop. Antes havia um botão flutuante global somado a um voltar próprio em
 * cada tela, e vários deles iam pra um destino fixo (/mapa) em vez de voltar.
 */
export function useGoBack() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const canGoBack = !NO_BACK.some((p) => pathname === p || pathname.startsWith(p));

  const goBack = useCallback(() => {
    try {
      if (window.history.length > 1) {
        router.history.back();
        return;
      }
    } catch {
      /* fallback abaixo */
    }
    // Entrou direto pela URL (sem histórico): manda pra Home.
    router.navigate({ to: "/home" });
  }, [router]);

  return { canGoBack, goBack };
}
