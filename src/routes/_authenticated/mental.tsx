import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Sprout, CalendarDays, Shield, Check, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import { BottomNav } from "@/components/shell/BottomNav";
import { MentalJournalCard } from "@/components/area/MentalJournalCard";
import {
  listMentalHistory,
  listUniqueBeliefs,
  listTodayConfrontations,
  toggleBeliefFacedToday,
  type MentalHistoryEntry,
  type BeliefConfrontation,
} from "@/lib/mental";

export const Route = createFileRoute("/_authenticated/mental")({
  head: () => ({
    meta: [
      { title: "Jardim Mental — Personal IA" },
      {
        name: "description",
        content:
          "Diário mental, calendário de gratidões e enfrentamento diário de crenças limitantes.",
      },
    ],
  }),
  component: MentalPage,
});

type Tab = "hoje" | "calendario" | "crencas";

function MentalPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("hoje");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  if (!userId) {
    return (
      <MobileShell>
        <div className="p-4 text-sm text-muted-foreground">Carregando…</div>
        <BottomNav />
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className="p-4 pb-32">
        <header className="mb-4">
          <p className="font-display text-[10px] tracking-[0.3em] text-emerald-400">
            JARDIM MENTAL
          </p>
          <h1 className="mt-1 font-display text-2xl tracking-wide text-foreground">
            Gratidões, crenças & reframing
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Semeie hoje, colha a nova versão de você.
          </p>
        </header>

        <nav className="mb-4 grid grid-cols-3 gap-2">
          <TabBtn active={tab === "hoje"} onClick={() => setTab("hoje")} icon={<Sprout className="h-3.5 w-3.5" />}>
            HOJE
          </TabBtn>
          <TabBtn active={tab === "calendario"} onClick={() => setTab("calendario")} icon={<CalendarDays className="h-3.5 w-3.5" />}>
            CALENDÁRIO
          </TabBtn>
          <TabBtn active={tab === "crencas"} onClick={() => setTab("crencas")} icon={<Shield className="h-3.5 w-3.5" />}>
            CRENÇAS
          </TabBtn>
        </nav>

        {tab === "hoje" && <MentalJournalCard userId={userId} />}
        {tab === "calendario" && <CalendarView userId={userId} />}
        {tab === "crencas" && <BeliefsView userId={userId} />}
      </div>
      <BottomNav />
    </MobileShell>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 font-display text-[10px] tracking-[0.25em] transition ${
        active
          ? "border-ember bg-ember text-charcoal-900"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ---------- Calendário / histórico ----------

function CalendarView({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<MentalHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MentalHistoryEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 60);
      const rows = await listMentalHistory(
        userId,
        from.toISOString().slice(0, 10),
        to.toISOString().slice(0, 10),
      );
      setEntries(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const days = useMemo(() => {
    const arr: { iso: string; entry?: MentalHistoryEntry }[] = [];
    const map = new Map(entries.map((e) => [e.log_date, e]));
    for (let i = 59; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      arr.push({ iso, entry: map.get(iso) });
    }
    return arr;
  }, [entries]);

  if (loading) {
    return <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
          ÚLTIMOS 60 DIAS
        </p>
        <div className="mt-3 grid grid-cols-10 gap-1.5">
          {days.map((d) => {
            const has = Boolean(d.entry);
            const hasBelief = Boolean(d.entry?.limiting_belief);
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => d.entry && setSelected(d.entry)}
                title={d.iso}
                className={`aspect-square rounded-sm border ${
                  has
                    ? hasBelief
                      ? "border-ember bg-ember/30"
                      : "border-emerald-500/50 bg-emerald-500/20"
                    : "border-border/50 bg-background"
                }`}
              />
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-emerald-500/40" /> gratidão registrada
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-ember/50" /> crença registrada
          </span>
        </div>
      </div>

      {selected && (
        <div className="rounded-2xl border border-ember/40 bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="font-display text-[10px] tracking-[0.3em] text-ember">
              {selected.log_date}
            </p>
            <button type="button" onClick={() => setSelected(null)} className="text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          {selected.gratitudes?.length > 0 && (
            <>
              <p className="mt-3 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
                GRATIDÕES
              </p>
              <ul className="mt-1 space-y-1 text-sm text-foreground">
                {selected.gratitudes.map((g, i) => (
                  <li key={i}>• {g}</li>
                ))}
              </ul>
            </>
          )}
          {selected.limiting_belief && (
            <>
              <p className="mt-3 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
                CRENÇA
              </p>
              <p className="mt-1 text-sm text-foreground">{selected.limiting_belief}</p>
            </>
          )}
          {selected.reframe && (
            <>
              <p className="mt-3 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
                REFRAMING
              </p>
              <p className="mt-1 text-sm text-foreground">{selected.reframe}</p>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => void load()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 font-display text-[10px] tracking-[0.25em] text-muted-foreground"
      >
        <RefreshCw className="h-3 w-3" />
        RECARREGAR
      </button>
    </div>
  );
}

// ---------- Crenças com enfrentamento diário ----------

function BeliefsView({ userId }: { userId: string }) {
  const [beliefs, setBeliefs] = useState<string[]>([]);
  const [today, setToday] = useState<Record<string, BeliefConfrontation | undefined>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, c] = await Promise.all([
        listUniqueBeliefs(userId),
        listTodayConfrontations(userId),
      ]);
      setBeliefs(b);
      const map: Record<string, BeliefConfrontation | undefined> = {};
      for (const x of c) map[x.belief] = x;
      setToday(map);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggle(belief: string, faced: boolean) {
    try {
      await toggleBeliefFacedToday(userId, belief, faced);
      toast.success(faced ? "Enfrentada hoje ✔" : "Marcada como pendente");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">Carregando…</div>;
  }

  if (beliefs.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Nenhuma crença registrada ainda. Vá para a aba <span className="text-ember">HOJE</span> e
        registre a primeira no diário mental.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
          ENFRENTAMENTO DE HOJE
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Marque as crenças que você olhou de frente hoje. A repetição transforma.
        </p>
      </div>

      {beliefs.map((belief) => {
        const c = today[belief];
        const faced = Boolean(c?.faced);
        return (
          <div
            key={belief}
            className={`rounded-2xl border p-4 ${
              faced ? "border-emerald-500/50 bg-emerald-500/5" : "border-border bg-card"
            }`}
          >
            <p className="text-sm text-foreground">"{belief}"</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => handleToggle(belief, true)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-display text-[10px] tracking-[0.25em] transition ${
                  faced
                    ? "bg-emerald-500 text-charcoal-900"
                    : "border border-border text-muted-foreground"
                }`}
              >
                <Check className="h-3.5 w-3.5" />
                ENFRENTEI
              </button>
              <button
                type="button"
                onClick={() => handleToggle(belief, false)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 font-display text-[10px] tracking-[0.25em] transition ${
                  !faced && c
                    ? "bg-ember text-charcoal-900"
                    : "border border-border text-muted-foreground"
                }`}
              >
                <X className="h-3.5 w-3.5" />
                AINDA NÃO
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
