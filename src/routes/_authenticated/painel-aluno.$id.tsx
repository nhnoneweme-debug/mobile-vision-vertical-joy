import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookHeart,
  Flame,
  Moon,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import { MobileShell } from "@/components/shell/MobileShell";
import {
  getStudentDeepSnapshot,
  sendMission,
  type StudentDeepSnapshot,
} from "@/lib/orientador";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/painel-aluno/$id")({
  head: () => ({
    meta: [
      { title: "Aluno · Painel do Orientador" },
      { name: "description", content: "Visão detalhada da jornada do aluno." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AlunoPage,
});

function AlunoPage() {
  const { id } = useParams({ from: "/_authenticated/painel-aluno/$id" });
  const [snap, setSnap] = useState<StudentDeepSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getStudentDeepSnapshot(id)
      .then((d) => {
        if (!cancelled) setSnap(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <MobileShell>
        <Header title="Carregando…" />
      </MobileShell>
    );
  }

  if (error || !snap) {
    return (
      <MobileShell>
        <Header title="Sem acesso" />
        <div className="px-4 py-6 text-sm text-muted-foreground">
          {error === "forbidden"
            ? "Este aluno não está vinculado a você ou o convite ainda não foi aceito."
            : (error ?? "Não foi possível carregar.")}
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <Header title={snap.profile.display_name ?? "Viajante"} subtitle={(snap.profile.behavioral_class ?? "").toUpperCase()} />
      <div className="space-y-5 px-4 py-5 pb-32">
        <StatsRow snap={snap} />
        <XPHeatmap snap={snap} />
        <AreasBlock snap={snap} />
        <SignalsBlock snap={snap} />
        {me && <QuickMissionForm orientadorId={me} studentId={id} onSent={() =>
          getStudentDeepSnapshot(id).then(setSnap).catch(() => {})} />}
        <MissionsList snap={snap} />
      </div>
    </MobileShell>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header
      className="flex items-start gap-3 border-b border-border px-4 pb-5"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
    >
      <Link
        to="/painel"
        className="mt-1 rounded-full border border-border p-2 active:scale-[0.97]"
        aria-label="Voltar ao painel"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
      </Link>
      <div className="min-w-0">
        <p className="font-display text-[10px] tracking-[0.4em] text-ember">
          ALUNO
        </p>
        <h1 className="mt-1 truncate font-display text-2xl tracking-wide text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
    </header>
  );
}

function StatsRow({ snap }: { snap: StudentDeepSnapshot }) {
  const missionsPending = snap.missions.filter((m) => m.status === "pending").length;
  const missionsDone = snap.missions.filter((m) => m.status === "completed").length;
  return (
    <div className="grid grid-cols-4 gap-2">
      <Stat label="XP" value={snap.profile.xp.toString()} />
      <Stat
        label="STREAK"
        value={
          <span className="flex items-center justify-center gap-1">
            <Flame className="h-3.5 w-3.5 text-ember" strokeWidth={2.5} />
            {snap.profile.streak}
          </span>
        }
      />
      <Stat label="A FAZER" value={missionsPending.toString()} />
      <Stat label="FEITAS" value={missionsDone.toString()} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-2 py-3 text-center">
      <p className="font-display text-[9px] tracking-[0.3em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-lg tracking-wide text-foreground">
        {value}
      </p>
    </div>
  );
}

function XPHeatmap({ snap }: { snap: StudentDeepSnapshot }) {
  const map = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of snap.xp_daily) m.set(d.day, d.xp);
    return m;
  }, [snap.xp_daily]);
  const days: Array<{ date: string; xp: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, xp: map.get(key) ?? 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.xp));
  return (
    <section>
      <SectionTitle icon={<Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />}>
        ATIVIDADE · 30D
      </SectionTitle>
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="grid grid-cols-15 gap-1" style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}>
          {days.map((d) => {
            const intensity = d.xp === 0 ? 0 : 0.15 + 0.85 * (d.xp / max);
            return (
              <div
                key={d.date}
                title={`${d.date}: ${d.xp} XP`}
                className="aspect-square rounded-sm border border-border/40"
                style={{
                  background:
                    d.xp === 0
                      ? "hsl(var(--card))"
                      : `hsl(var(--ember-hsl, 20 90% 55%) / ${intensity})`,
                }}
              />
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Cada bloco = 1 dia. Cor mais viva = mais XP.
        </p>
      </div>
    </section>
  );
}

function AreasBlock({ snap }: { snap: StudentDeepSnapshot }) {
  if (snap.areas.length === 0) return null;
  const max = Math.max(1, ...snap.areas.map((a) => a.xp));
  return (
    <section>
      <SectionTitle icon={<Target className="h-3.5 w-3.5" strokeWidth={2.5} />}>
        ÁREAS
      </SectionTitle>
      <div className="space-y-1.5">
        {snap.areas.map((a) => (
          <div key={a.area_slug} className="rounded-lg border border-border bg-card px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-display tracking-widest text-foreground">
                {a.area_slug.toUpperCase()}
              </span>
              <span className="font-display text-[10px] tracking-[0.2em] text-ember">
                NV {a.level} · {a.xp} XP
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-charcoal-900">
              <div
                className="h-full bg-ember"
                style={{ width: `${Math.round((a.xp / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SignalsBlock({ snap }: { snap: StudentDeepSnapshot }) {
  const ritualCount = snap.rituals.length;
  const sleepAvg =
    snap.sleep.length === 0
      ? null
      : (
          snap.sleep.reduce((s, r) => s + (r.hours ?? 0), 0) / snap.sleep.length
        ).toFixed(1);
  const moodAvg =
    snap.mood.length === 0
      ? null
      : (
          snap.mood.reduce((s, r) => s + (r.mood_score ?? 0), 0) / snap.mood.length
        ).toFixed(1);
  const habitActive = snap.habits.filter((h) => h.active).length;
  const habitAdherence =
    snap.habits.length === 0
      ? null
      : Math.round(
          (100 *
            snap.habits.reduce((s, h) => s + h.logs_30d, 0)) /
            Math.max(1, snap.habits.reduce((s, h) => s + h.target_per_week * 4, 0)),
        );

  return (
    <section>
      <SectionTitle icon={<BookHeart className="h-3.5 w-3.5" strokeWidth={2.5} />}>
        SINAIS · 30D
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <SignalCard
          icon={<Moon className="h-3.5 w-3.5 text-ember" strokeWidth={2.5} />}
          label="RITUAIS"
          value={ritualCount.toString()}
          hint={`sono méd. ${sleepAvg ?? "—"}h`}
        />
        <SignalCard
          label="HÁBITOS ATIVOS"
          value={habitActive.toString()}
          hint={habitAdherence !== null ? `adesão ${habitAdherence}%` : "—"}
        />
        <SignalCard
          label="HUMOR MÉD."
          value={moodAvg ?? "—"}
          hint={`${snap.mood.length} entradas`}
        />
        <SignalCard
          label="ÚLTIMA SESSÃO"
          value={snap.xp_daily.length > 0
            ? snap.xp_daily[snap.xp_daily.length - 1].day.slice(5)
            : "—"}
          hint={`${snap.xp_daily.length} dias ativos`}
        />
      </div>
    </section>
  );
}

function SignalCard({
  icon,
  label,
  value,
  hint,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 font-display text-[9px] tracking-[0.3em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-display text-xl tracking-wide text-foreground">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function QuickMissionForm({
  orientadorId,
  studentId,
  onSent,
}: {
  orientadorId: string;
  studentId: string;
  onSent: () => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [xp, setXp] = useState(50);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await sendMission({
        orientadorId,
        studentId,
        title: title.trim(),
        detail: detail.trim() || undefined,
        xp_reward: xp,
      });
      toast.success("Missão enviada ao aluno.");
      setTitle("");
      setDetail("");
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <SectionTitle icon={<Send className="h-3.5 w-3.5" strokeWidth={2.5} />}>
        NOVA MISSÃO
      </SectionTitle>
      <form
        onSubmit={submit}
        className="space-y-2 rounded-xl border border-border bg-card p-3"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da missão"
          className="w-full rounded-lg border border-border bg-charcoal-900 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60"
        />
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Detalhes (opcional)"
          rows={2}
          className="w-full resize-none rounded-lg border border-border bg-charcoal-900 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60"
        />
        <div className="flex items-center gap-2">
          <label className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">
            XP
          </label>
          <input
            type="number"
            min={10}
            max={500}
            step={5}
            value={xp}
            onChange={(e) => setXp(Number(e.target.value) || 50)}
            className="w-20 rounded-lg border border-border bg-charcoal-900 px-2 py-1.5 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="ml-auto rounded-lg border border-ember/40 bg-ember/10 px-4 py-2 font-display text-xs tracking-widest text-ember active:scale-[0.97] disabled:opacity-50"
          >
            {saving ? "ENVIANDO…" : "ENVIAR"}
          </button>
        </div>
      </form>
    </section>
  );
}

function MissionsList({ snap }: { snap: StudentDeepSnapshot }) {
  if (snap.missions.length === 0) return null;
  return (
    <section>
      <SectionTitle>MISSÕES RECENTES</SectionTitle>
      <div className="space-y-2">
        {snap.missions.slice(0, 10).map((m) => (
          <div key={m.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate font-display text-sm tracking-wide text-foreground">
                {m.title}
              </p>
              <span className="font-display text-[10px] tracking-[0.25em] text-ember">
                +{m.xp_reward}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {statusLabel(m.status)} · {new Date(m.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h2 className="mb-2 flex items-center gap-1.5 font-display text-[10px] tracking-[0.35em] text-muted-foreground">
      {icon}
      {children}
    </h2>
  );
}

function statusLabel(s: string) {
  return s === "pending" ? "pendente" : s === "completed" ? "concluída" : "cancelada";
}
