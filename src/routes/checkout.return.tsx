import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  return (
    <MobileShell>
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-5 px-6 text-center">
        <CheckCircle2 className="h-16 w-16 text-ember" strokeWidth={1.8} />
        <h1 className="font-display text-2xl tracking-wide text-foreground">
          {session_id ? "Pagamento processado" : "Sem informações de sessão"}
        </h1>
        {session_id && (
          <p className="font-sans text-sm text-muted-foreground">
            Em instantes seu plano e Brasas serão liberados.
          </p>
        )}
        <Link
          to="/mapa"
          className="rounded-xl bg-ember px-5 py-3 font-display text-sm tracking-[0.18em] text-charcoal-900"
        >
          VOLTAR AO MAPA
        </Link>
      </div>
    </MobileShell>
  );
}
