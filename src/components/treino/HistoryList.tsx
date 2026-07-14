import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Dumbbell, Trophy, Check, X, ArrowRight } from "lucide-react";
import { getWorkoutHistory, type HistoryEntry } from "@/lib/workouts.functions";

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return mm ? `${h}h ${mm}min` : `${h}h`;
  }
  if (m === 0) return `${s}s`;
  return s ? `${m} min ${s}s` : `${m} min`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

function weekKey(iso: string): { key: string; label: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  const day = (dt.getDay() + 6) % 7; // 0=segunda
  const monday = new Date(dt);
  monday.setDate(dt.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const key = monday.toISOString().slice(0, 10);
  const fmt = (x: Date) => x.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return { key, label: `${fmt(monday)} — ${fmt(sunday)}` };
}

export function SessionCard({
  entry,
  defaultOpen = false,
  showViewAll = true,
}: {
  entry: HistoryEntry;
  defaultOpen?: boolean;
  showViewAll?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <article className="forge-card overflow-hidden rounded-2xl border border-border bg-charcoal-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-charcoal-800"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-charcoal-800 text-ember">
          <Dumbbell className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-sm tracking-wide text-foreground">
              {entry.dayName}
            </span>
            {entry.exercises.some((e) => e.isPR) && (
              <span className="inline-flex items-center gap-1 rounded-md bg-ember/20 px-1.5 py-0.5 font-display text-[9px] tracking-[0.2em] text-ember">
                <Trophy className="h-3 w-3" /> PR
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="capitalize">{fmtDate(entry.sessionDate)}</span>
            <span>·</span>
            <span>{fmtDur(entry.durationSec)}</span>
            <span>·</span>
            <span>
              {entry.exercisesDone}/{entry.exercisesTotal}
            </span>
            {entry.volumeKg > 0 && (
              <>
                <span>·</span>
                <span>{entry.volumeKg} kg</span>
              </>
            )}
          </div>
        </div>
        <ChevronDown
          className={"h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 " + (open ? "rotate-180" : "")}
          strokeWidth={2.4}
        />
      </button>

      <div
        className={
          "grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out " +
          (open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")
        }
      >
        <div className="min-h-0">
          <div className="border-t border-border px-3.5 py-3">
            {entry.exercises.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Sem detalhe de exercícios para esta sessão.
              </p>
            ) : (
              <ul className="space-y-2">
                {entry.exercises.map((ex) => (
                  <li key={ex.key} className="rounded-xl bg-charcoal-800/60 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          "grid h-6 w-6 place-items-center rounded-md " +
                          (ex.done
                            ? "bg-ember/20 text-ember"
                            : "bg-charcoal-900 text-muted-foreground")
                        }
                        aria-label={ex.done ? "concluído" : "incompleto"}
                      >
                        {ex.done ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        ) : (
                          <X className="h-3.5 w-3.5" strokeWidth={3} />
                        )}
                      </span>
                      <span className="flex-1 truncate font-display text-sm tracking-wide text-foreground">
                        {ex.name}
                      </span>
                      {ex.isPR && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-ember/20 px-1.5 py-0.5 font-display text-[9px] tracking-[0.2em] text-ember">
                          <Trophy className="h-3 w-3" /> PR
                        </span>
                      )}
                    </div>
                    <p className="mt-1 pl-8 text-[11px] text-muted-foreground">
                      {ex.series > 0
                        ? `${ex.series} ${ex.series === 1 ? "série" : "séries"}${
                            ex.weights.length
                              ? ": " +
                                ex.weights
                                  .map((w) => (w > 0 ? `${w}kg` : "—"))
                                  .join(" · ")
                              : ""
                          }`
                        : "Sem séries registradas."}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {showViewAll && (
              <Link
                to="/treino/historico/$sessionId"
                params={{ sessionId: entry.sessionId }}
                className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-charcoal-800 px-3 py-2 font-display text-[11px] tracking-[0.2em] text-muted-foreground active:scale-[0.98]"
              >
                VER TUDO <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function HistoryList() {
  const fn = useServerFn(getWorkoutHistory);
  const [data, setData] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fn({ data: undefined as never })
      .then((r) => {
        if (mounted) setData(r.sessions);
      })
      .catch((e: unknown) => {
        if (mounted) setError(e instanceof Error ? e.message : "Erro ao carregar histórico.");
      });
    return () => {
      mounted = false;
    };
  }, [fn]);

  if (error) {
    return (
      <div className="forge-card rounded-2xl px-4 py-6 text-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl border border-border bg-charcoal-900/60" />
        ))}
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <div className="forge-card rounded-2xl px-4 py-8 text-center">
        <p className="font-display text-sm tracking-wide text-foreground">
          Nenhum treino registrado ainda
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Finalize uma sessão pra aparecer aqui.
        </p>
      </div>
    );
  }

  // Agrupa por semana (segunda a domingo)
  const groups = new Map<string, { label: string; items: HistoryEntry[] }>();
  for (const e of data) {
    const { key, label } = weekKey(e.sessionDate);
    if (!groups.has(key)) groups.set(key, { label, items: [] });
    groups.get(key)!.items.push(e);
  }
  const ordered = Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <div className="space-y-5">
      {ordered.map(([k, g]) => (
        <div key={k}>
          <p className="mb-2 px-1 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
            {g.label.toUpperCase()}
          </p>
          <div className="space-y-2">
            {g.items.map((e) => (
              <SessionCard key={e.sessionId} entry={e} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
