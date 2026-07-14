import { createFileRoute, Link, useParams, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";
import { SessionCard } from "@/components/treino/HistoryList";
import { getWorkoutHistory, type HistoryEntry } from "@/lib/workouts.functions";

export const Route = createFileRoute("/_authenticated/treino/historico/$sessionId")({
  component: SessionDetailPage,
  errorComponent: ({ error }) => (
    <MobileShell>
      <div className="px-4 py-6 text-sm text-muted-foreground" role="alert">
        {error.message}
      </div>
    </MobileShell>
  ),
  notFoundComponent: () => (
    <MobileShell>
      <div className="px-4 py-6 text-sm text-muted-foreground">Sessão não encontrada.</div>
    </MobileShell>
  ),
});

function SessionDetailPage() {
  const { sessionId } = useParams({ from: "/_authenticated/treino/historico/$sessionId" });
  const fn = useServerFn(getWorkoutHistory);
  const router = useRouter();
  const [entry, setEntry] = useState<HistoryEntry | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    fn({ data: undefined as never })
      .then((r) => {
        if (!mounted) return;
        setEntry(r.sessions.find((s) => s.sessionId === sessionId) ?? null);
      })
      .catch(() => mounted && setEntry(null));
    return () => {
      mounted = false;
    };
  }, [fn, sessionId]);

  return (
    <MobileShell>
      <header className="flex items-center gap-3 px-4 pt-4">
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label="Voltar"
          className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-charcoal-900 text-foreground active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] tracking-[0.3em] text-ember">HISTÓRICO</p>
          <h1 className="truncate font-display text-lg tracking-wide text-foreground">
            {entry ? entry.dayName : "Sessão"}
          </h1>
        </div>
      </header>

      <section className="px-4 pt-4">
        {entry === undefined && (
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-charcoal-900/60" />
        )}
        {entry === null && (
          <div className="forge-card rounded-2xl px-4 py-8 text-center text-sm text-muted-foreground">
            Sessão não encontrada.
            <div className="mt-3">
              <Link to="/treino" className="text-ember underline">
                Voltar para Treino
              </Link>
            </div>
          </div>
        )}
        {entry && <SessionCard entry={entry} defaultOpen showViewAll={false} />}
      </section>

      <div className="h-24" />
    </MobileShell>
  );
}
