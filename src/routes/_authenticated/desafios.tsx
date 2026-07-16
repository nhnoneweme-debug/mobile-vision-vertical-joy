import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Swords } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/shell/MobileShell";
import {
  evaluateMyProgress,
  joinChallenge,
  listChallengeRewards,
  listChallengesStudio,
  METRIC_LABELS,
  type StudioChallenge,
} from "@/lib/studio";

export const Route = createFileRoute("/_authenticated/desafios")({
  head: () => ({
    meta: [
      { title: "Desafios — Weme" },
      { name: "description", content: "Desafios coletivos com prêmios dinâmicos." },
    ],
  }),
  component: ChallengesPlayerPage,
});

function ChallengesPlayerPage() {
  const [list, setList] = useState<StudioChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setList(await listChallengesStudio(false));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <MobileShell>
      <section className="border-b border-border px-4 pb-4 pt-6" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
        <p className="font-display text-[10px] tracking-[0.3em] text-ember">CONVÍVIO</p>
        <h1 className="mt-1 font-display text-4xl tracking-wide text-foreground">Desafios</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Provações com múltiplas perspectivas e prêmios em cascata.
        </p>
      </section>

      <div className="space-y-4 px-4 py-5 pb-32">
        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum desafio publicado no momento.
          </p>
        ) : (
          list.map((c) => <ChallengeBlock key={c.id} c={c} />)
        )}
      </div>

    </MobileShell>
  );
}

function ChallengeBlock({ c }: { c: StudioChallenge }) {
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof evaluateMyProgress>>>([]);
  const [rewards, setRewards] = useState<Awaited<ReturnType<typeof listChallengeRewards>>>([]);

  useEffect(() => {
    (async () => {
      const [p, r] = await Promise.all([evaluateMyProgress(c.id), listChallengeRewards(c.id)]);
      setProgress(p);
      setRewards(r);
    })();
  }, [c.id]);

  return (
    <article className="rounded-2xl border border-border bg-charcoal-900/30 p-4">
      <div className="flex items-start gap-3">
        <span className="rounded-full bg-ember/20 p-2 text-ember">
          <Swords className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h3 className="font-display text-lg tracking-wide text-foreground">{c.title}</h3>
          {c.description ? <p className="mt-1 text-sm text-muted-foreground">{c.description}</p> : null}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {progress.map((p) => (
          <div key={p.name}>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{p.name || METRIC_LABELS[p.metric as keyof typeof METRIC_LABELS] || p.metric}</span>
              <span>
                {p.actual} / {p.target}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-charcoal-900">
              <div className="h-full bg-ember" style={{ width: `${Math.round((p.pct ?? 0) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {rewards.length > 0 ? (
        <div className="mt-3 rounded-xl border border-border bg-charcoal-900/40 p-3">
          <p className="font-display text-[10px] tracking-[0.22em] text-muted-foreground">PRÊMIOS</p>
          <ul className="mt-1 space-y-1 text-xs text-foreground">
            {rewards.map((r) => (
              <li key={r.id}>
                Tier {r.tier} — {r.studio_rewards.name} <span className="text-muted-foreground">({r.studio_rewards.kind})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        onClick={async () => {
          try {
            await joinChallenge(c.id);
            toast.success("Você entrou no desafio.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha");
          }
        }}
        className="mt-3 w-full rounded-full bg-ember py-2 font-display text-[11px] tracking-[0.18em] text-charcoal-900"
      >
        ENTRAR NO DESAFIO
      </button>
    </article>
  );
}
