import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Trophy, Calendar, Camera, X, Check } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/shell/MobileShell";
import {
  getChallenge,
  leaderboard,
  calendarFor,
  myCheckins,
  didCheckinToday,
  checkinToChallenge,
  finalizeIfEnded,
  todayWorkoutSessionId,
  statusOf,
  type Challenge,
  type LeaderboardRow,
  type CalendarRow,
} from "@/lib/challenges";

export const Route = createFileRoute("/_authenticated/circulo/desafio/$id")({
  head: () => ({ meta: [{ title: "Desafio — Personal IA" }] }),
  component: DesafioDetailPage,
  errorComponent: ({ reset }) => (
    <MobileShell>
      <div className="px-4 pt-8 text-center text-sm text-muted-foreground">
        Não consegui carregar o desafio.
        <button className="ml-2 text-ember underline" onClick={reset}>tentar de novo</button>
      </div>
    </MobileShell>
  ),
  notFoundComponent: () => (
    <MobileShell>
      <div className="px-4 pt-8 text-center text-sm text-muted-foreground">Desafio não encontrado.</div>
    </MobileShell>
  ),
});

function DesafioDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [board, setBoard] = useState<LeaderboardRow[] | null>(null);
  const [calRows, setCalRows] = useState<CalendarRow[] | null>(null);
  const [didToday, setDidToday] = useState(false);
  const [openCheckin, setOpenCheckin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [linkTraining, setLinkTraining] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const c = await getChallenge(id);
      if (!c) throw new Error("not_found");
      setChallenge(c);
      if (statusOf(c) === "ended" && !c.finalized_at) {
        try { await finalizeIfEnded(c.id); } catch { /* noop */ }
      }
      const [b, cal, today] = await Promise.all([
        leaderboard(id),
        calendarFor(id, new Date(c.starts_at)),
        didCheckinToday(id),
      ]);
      setBoard(b);
      setCalRows(cal);
      setDidToday(today);
    } catch {
      setChallenge(null);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { void myCheckins; }, []); // reserva de import

  const status = challenge ? statusOf(challenge) : "active";
  const canCheckin = status === "active" && !didToday;

  async function confirmCheckin() {
    if (!challenge) return;
    setBusy(true);
    try {
      const wsId = linkTraining ? await todayWorkoutSessionId() : null;
      await checkinToChallenge({
        challengeId: challenge.id,
        workoutSessionId: wsId,
        note,
        photoFile: photo,
      });
      toast.success("Check-in registrado!");
      setOpenCheckin(false);
      setNote("");
      setPhoto(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no check-in.");
    } finally {
      setBusy(false);
    }
  }

  const daysGrid = useMemo(() => {
    if (!challenge) return [] as { date: string; users: string[] }[];
    const start = new Date(challenge.starts_at);
    const end = new Date(challenge.ends_at);
    const days: { date: string; users: string[] }[] = [];
    const d = new Date(start);
    while (d <= end && days.length < 62) {
      const iso = d.toISOString().slice(0, 10);
      const users = (calRows ?? [])
        .filter((r) => r.checkin_date === iso)
        .map((r) => r.display_name);
      days.push({ date: iso, users });
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [challenge, calRows]);

  return (
    <MobileShell>
      <header
        className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-charcoal-900/85 pb-3 pl-4 pr-4 pt-5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <button onClick={() => navigate({ to: "/circulo" })} className="grid h-9 w-9 place-items-center rounded-lg border border-border">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg tracking-wide text-foreground">
            {challenge?.title ?? "Desafio"}
          </h1>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {challenge?.group_name ?? ""} · {challenge?.metric} · meta {challenge?.target}
          </p>
        </div>
      </header>

      {!challenge ? (
        <div className="space-y-2 px-4 pt-4">
          <div className="h-24 animate-pulse rounded-2xl bg-charcoal-800" />
          <div className="h-24 animate-pulse rounded-2xl bg-charcoal-800" />
        </div>
      ) : (
        <>
          {status === "ended" && (
            <section className="px-4 pt-3">
              <div className="forge-card flex items-center gap-2 rounded-2xl p-3.5">
                <Trophy className="h-5 w-5 text-ember" />
                <div className="text-sm">
                  <p className="font-display tracking-wide text-foreground">Encerrado</p>
                  <p className="text-[11px] text-muted-foreground">
                    {board?.[0]?.display_name
                      ? `Vencedor: ${board[0].display_name} (${board[0].value})`
                      : "Sem vencedor."}
                  </p>
                </div>
              </div>
            </section>
          )}

          {status === "upcoming" && (
            <section className="px-4 pt-3">
              <div className="rounded-2xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                Começa em {new Date(challenge.starts_at).toLocaleDateString("pt-BR")}.
              </div>
            </section>
          )}

          {/* Botão principal */}
          {status === "active" && (
            <section className="px-4 pt-4">
              <button
                type="button"
                onClick={() => setOpenCheckin(true)}
                disabled={!canCheckin}
                className={
                  "w-full rounded-2xl py-4 font-display text-base tracking-wide active:scale-[0.99] " +
                  (canCheckin
                    ? "bg-ember text-charcoal-900"
                    : "border border-border bg-charcoal-800 text-muted-foreground")
                }
              >
                {didToday ? "✓ Check-in feito hoje" : "Check-in de hoje"}
              </button>
            </section>
          )}

          {/* Ranking */}
          <section className="px-4 pt-4">
            <p className="mb-2 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
              RANKING
            </p>
            {board === null ? (
              <div className="h-24 animate-pulse rounded-2xl bg-charcoal-800" />
            ) : board.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                Sem participantes ainda.
              </p>
            ) : (
              <div className="space-y-1.5">
                {board.map((r) => (
                  <div
                    key={r.user_id}
                    className={
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 " +
                      (r.rank === 1
                        ? "border-ember/50 bg-ember/5"
                        : "border-border bg-charcoal-900")
                    }
                  >
                    <span
                      className={
                        "grid h-7 w-7 place-items-center rounded-full font-display text-sm " +
                        (r.rank === 1
                          ? "bg-ember text-charcoal-900"
                          : "bg-charcoal-800 text-muted-foreground")
                      }
                    >
                      {r.rank}
                    </span>
                    <span className="flex-1 truncate font-display text-sm tracking-wide text-foreground">
                      {r.display_name}
                    </span>
                    <span className="font-display text-lg text-ember">{r.value}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Calendário */}
          <section className="px-4 pt-5">
            <p className="mb-2 flex items-center gap-1.5 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
              <Calendar className="h-3 w-3" /> CALENDÁRIO
            </p>
            {calRows === null ? (
              <div className="h-32 animate-pulse rounded-2xl bg-charcoal-800" />
            ) : daysGrid.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                Sem dias no período.
              </p>
            ) : (
              <div className="grid grid-cols-7 gap-1.5">
                {daysGrid.map((d) => (
                  <div
                    key={d.date}
                    className={
                      "flex aspect-square flex-col items-center justify-center rounded-lg border text-[10px] " +
                      (d.users.length > 0
                        ? "border-ember/50 bg-ember/10 text-ember"
                        : "border-border bg-charcoal-900 text-muted-foreground")
                    }
                    title={d.users.join(", ")}
                  >
                    <span className="font-display text-xs">
                      {new Date(d.date + "T00:00:00").getDate()}
                    </span>
                    {d.users.length > 0 && (
                      <span className="text-[9px]">{d.users.length}●</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="h-24" />
        </>
      )}

      {/* Sheet check-in */}
      {openCheckin && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setOpenCheckin(false)}
        >
          <div
            className="w-full max-w-[var(--shell-max,480px)] rounded-t-3xl border border-border bg-charcoal-900 p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-ember" />
              <h3 className="flex-1 font-display text-base tracking-wide text-foreground">
                Check-in de hoje
              </h3>
              <button onClick={() => setOpenCheckin(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <label className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={linkTraining}
                onChange={(e) => setLinkTraining(e.target.checked)}
                className="h-4 w-4 accent-ember"
              />
              <span className="text-muted-foreground">Vincular treino de hoje (se houver)</span>
            </label>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              rows={2}
              placeholder="Uma nota rápida (opcional)"
              className="mb-2 w-full resize-none rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ember/60 focus:outline-none"
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mb-3 flex w-full items-center gap-2 rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-muted-foreground"
            >
              <Camera className="h-4 w-4" />
              {photo ? photo.name : "Foto do treino (opcional)"}
              {photo && (
                <Check className="ml-auto h-4 w-4 text-ember" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />

            <button
              type="button"
              onClick={confirmCheckin}
              disabled={busy}
              className="w-full rounded-xl bg-ember py-3 font-display text-sm tracking-wide text-charcoal-900 disabled:opacity-50 active:scale-[0.99]"
            >
              {busy ? "Registrando..." : "Confirmar check-in"}
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-24 right-4 z-30">
        <Link
          to="/circulo"
          className="text-[10px] font-display tracking-[0.2em] text-muted-foreground"
        >
          ↩ VOLTAR
        </Link>
      </div>
    </MobileShell>
  );
}
