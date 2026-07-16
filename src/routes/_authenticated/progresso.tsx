import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { MobileShell } from "@/components/shell/MobileShell";
import { ScoreRing } from "@/components/progresso/ScoreRing";
import { Sparkline } from "@/components/progresso/Sparkline";
import { supabase } from "@/integrations/supabase/client";
import {
  DIMENSION_LABEL,
  DIMENSION_UNIT,
  fetchCurrentScore,
  fetchScoreHistory,
  saveCurrentSnapshot,
  type PersonalIaScore,
  type ScoreBreakdown,
  type ScoreSnapshot,
} from "@/lib/score";
import { AREAS } from "@/components/map/areas";
import { areaLevelProgress, listAllAreaProgress } from "@/lib/area-missions";

export const Route = createFileRoute("/_authenticated/progresso")({
  head: () => ({
    meta: [
      { title: "Templo do Progresso — Personal IA" },
      {
        name: "description",
        content: "Seu Personal IA Score consolidado e evolução semanal.",
      },
    ],
  }),
  component: ProgressoPage,
});

function ProgressoPage() {
  const [current, setCurrent] = useState<PersonalIaScore | null>(null);
  const [history, setHistory] = useState<ScoreSnapshot[]>([]);
  const [areaRows, setAreaRows] = useState<
    { slug: string; name: string; level: number; pct: number; xp: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      try {
        const score = await fetchCurrentScore(data.user.id);
        setCurrent(score);
        await saveCurrentSnapshot(data.user.id, score);
        const hist = await fetchScoreHistory(data.user.id, 8);
        setHistory(hist);

        const aps = await listAllAreaProgress(data.user.id);
        const mapByName = Object.fromEntries(
          AREAS.map((a) => [a.slug, a.name] as const),
        );
        const rows = aps
          .filter((a) => mapByName[a.area_slug])
          .map((a) => {
            const meta = areaLevelProgress(a.xp);
            return {
              slug: a.area_slug,
              name: mapByName[a.area_slug],
              level: meta.level,
              pct: meta.pct,
              xp: a.xp,
            };
          })
          .sort((a, b) => b.xp - a.xp);
        setAreaRows(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const prevScore = history.length >= 2 ? history[history.length - 2].score : null;
  const delta = prevScore !== null && current ? current.score - prevScore : null;
  const points = history.map((h) => h.score);
  if (current && points[points.length - 1] !== current.score) {
    points.push(current.score);
  }

  return (
    <MobileShell>
      <header className="flex items-center gap-3 px-4 pt-6">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-ember" />
          <h1 className="font-display text-2xl tracking-[0.18em] text-foreground">
            TEMPLO DO PROGRESSO
          </h1>
        </div>
      </header>

      <section className="px-4 pt-6">
        {loading || !current ? (
          <div className="mx-auto h-[220px] w-[220px] animate-pulse rounded-full bg-charcoal-800" />
        ) : (
          <ScoreRing score={current.score} delta={delta} />
        )}
      </section>

      <section className="px-4 pt-6">
        <p className="mb-2 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
          EVOLUÇÃO — 8 SEMANAS
        </p>
        <div className="rounded-2xl border border-border bg-card p-3">
          <Sparkline points={points} />
        </div>
      </section>

      <section className="space-y-3 px-4 pt-6">
        <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
          AS QUATRO DIMENSÕES
        </p>
        {current &&
          (Object.keys(current.breakdown) as (keyof ScoreBreakdown)[]).map((key) => {
            const d = current.breakdown[key];
            const pct = Math.round((d.score / d.max) * 100);
            return (
              <div
                key={key}
                className="rounded-2xl border border-border bg-card p-3"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-sm tracking-[0.15em] text-foreground">
                    {DIMENSION_LABEL[key].toUpperCase()}
                  </span>
                  <span className="font-display text-xs tracking-[0.2em] text-ember">
                    {d.score}/{d.max}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-charcoal-800">
                  <div
                    className="h-full bg-ember transition-[width] duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 font-body text-[11px] text-muted-foreground">
                  {d.value} {DIMENSION_UNIT[key]}
                </p>
              </div>
            );
          })}
      </section>

      <section className="space-y-2 px-4 pb-10 pt-6">
        <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
          ÁREAS — DAS MAIS FORTES ÀS MAIS FRACAS
        </p>
        {areaRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Complete missões nas áreas para começar a evolução.
          </p>
        ) : (
          areaRows.map((row) => (
            <Link
              key={row.slug}
              to="/area/$slug"
              params={{ slug: row.slug }}
              className="block rounded-xl border border-border bg-card p-3 active:scale-[0.99]"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-display text-sm tracking-[0.12em] text-foreground">
                  {row.name.toUpperCase()}
                </span>
                <span className="font-display text-[10px] tracking-[0.25em] text-ember">
                  NV {row.level}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-charcoal-800">
                <div
                  className="h-full bg-ember"
                  style={{ width: `${row.pct}%` }}
                />
              </div>
            </Link>
          ))
        )}
      </section>
    </MobileShell>
  );
}
