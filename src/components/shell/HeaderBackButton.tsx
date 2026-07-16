import { ChevronLeft } from "lucide-react";
import { useGoBack } from "@/hooks/useGoBack";

/**
 * Voltar para o header das telas imersivas (chat da IA, dumps).
 *
 * Essas telas escondem a barra inferior — o composer ocupa o rodapé — então
 * precisam da própria saída. Continua valendo a regra de um voltar por
 * viewport: onde existe MobileShell, a sidebar já traz o voltar no desktop, e
 * aí este fica `lg:hidden` (`onlyMobile`). O DumpChat não tem shell nenhum,
 * então lá ele aparece nos dois.
 */
export function HeaderBackButton({ onlyMobile = false }: { onlyMobile?: boolean }) {
  const { canGoBack, goBack } = useGoBack();
  if (!canGoBack) return null;

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Voltar"
      className={
        "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-charcoal-900/85 text-foreground transition-colors hover:text-ember active:scale-95 " +
        (onlyMobile ? "lg:hidden" : "")
      }
    >
      <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
    </button>
  );
}
