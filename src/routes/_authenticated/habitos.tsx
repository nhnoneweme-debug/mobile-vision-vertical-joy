import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Sunrise, Moon, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import { HabitRow } from "@/components/habits/HabitRow";
import { HabitManagerSheet } from "@/components/habitos/HabitManagerSheet";
import { PinManager } from "@/components/habitos/PinManager";
import { LogList } from "@/components/habitos/LogList";
import { XPToast } from "@/components/map/XPToast";
import {
  archiveHabit,
  createHabit,
  listHabits,
  toggleHabit,
  type HabitWithMeta,
} from "@/lib/habits";

export const Route = createFileRoute("/_authenticated/habitos")({
  head: () => ({
    meta: [
      { title: "Hábitos — Weme" },
      { name: "description", content: "Seus rituais diários, dumps e o histórico de tudo." },
    ],
  }),
  component: HabitosPage,
});

type Tab = "hoje" | "fixar" | "dump" | "log";

const TABS: { id: Tab; label: string }[] = [
  { id: "hoje", label: "HOJE" },
  { id: "fixar", label: "FIXAR" },
  { id: "dump", label: "DUMP" },
  { id: "log", label: "LOG" },
];

function HabitosPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [habits, setHabits] = useState<HabitWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [xpToast, setXpToast] = useState<{ amount: number; leveledUp: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>("hoje");
  const [managerOpen, setManagerOpen] = useState(false);

  const refresh = useCallback(async (uid: string) => {
    setHabits(await listHabits(uid));
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      try {
        await refresh(data.user.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao carregar hábitos");
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  async function handleToggle(h: HabitWithMeta) {
    if (!userId) return;
    setPending(h.id);
    const wasDone = h.done_today;
    try {
      await toggleHabit(h, userId);
      await refresh(userId);
      if (!wasDone) setXpToast({ amount: 10, leveledUp: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setPending(null);
    }
  }

  async function handleArchive(h: HabitWithMeta) {
    if (!userId) return;
    setPending(h.id);
    try {
      await archiveHabit(h.id);
      await refresh(userId);
      toast.success("Hábito arquivado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setPending(null);
    }
  }

  async function handleCreate(input: { title: string; icon: string; target_per_week: number }) {
    if (!userId) return;
    try {
      await createHabit(userId, input);
      await refresh(userId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  const doneToday = habits.filter((h) => h.done_today).length;

  return (
    <MobileShell>
      <section
        className="sticky top-0 z-30 border-b border-border bg-charcoal-900/85 px-4 pb-3 pt-5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <p className="font-display text-[10px] tracking-[0.3em] text-ember">RITUAIS</p>

        {/* O título é o acesso ao gerenciamento — precisa ser <button> de verdade
            (foco por teclado, aria-expanded); um <h1> com onClick não é focável. */}
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={managerOpen}
          className="mt-1 flex items-center gap-1.5 rounded-lg text-left transition-colors hover:text-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
        >
          <h1 className="font-display text-4xl tracking-wide text-foreground">Hábitos</h1>
          <ChevronDown className="h-5 w-5 text-muted-foreground" strokeWidth={2.4} />
        </button>

        <p className="mt-1.5 text-sm text-muted-foreground">
          {habits.length === 0
            ? "Toque no título para criar seu primeiro hábito."
            : `${doneToday} de ${habits.length} feitos hoje · +10 XP cada`}
        </p>

        <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl border border-border bg-charcoal-900 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                "flex-1 shrink-0 rounded-lg px-3 py-1.5 font-display text-[10px] tracking-[0.15em] transition-colors " +
                (tab === t.id ? "bg-ember text-charcoal-900" : "text-muted-foreground")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <div className="px-4 py-5 pb-32">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Carregando…</p>
        ) : tab === "hoje" ? (
          habits.length === 0 ? (
            <p className="rounded-2xl border border-border bg-charcoal-900 px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhum hábito ainda. Toque em “Hábitos” lá em cima para criar o primeiro.
            </p>
          ) : (
            <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
              {habits.map((h) => (
                <HabitRow
                  key={h.id}
                  habit={h}
                  pending={pending === h.id}
                  onToggle={() => handleToggle(h)}
                  onArchive={() => handleArchive(h)}
                />
              ))}
            </div>
          )
        ) : tab === "fixar" ? (
          <PinManager habits={habits} onChanged={() => userId && refresh(userId)} />
        ) : tab === "dump" ? (
          <DumpCards />
        ) : (
          <LogList />
        )}
      </div>

      <HabitManagerSheet
        open={managerOpen}
        onOpenChange={setManagerOpen}
        habits={habits}
        onCreate={handleCreate}
        onArchive={handleArchive}
        pendingId={pending}
      />

      {xpToast && (
        <XPToast
          amount={xpToast.amount}
          leveledUp={xpToast.leveledUp}
          onDone={() => setXpToast(null)}
        />
      )}
    </MobileShell>
  );
}

/**
 * Entradas do dump. Navega para as telas existentes em vez de embutir o chat:
 * elas são imersivas (tela cheia) e já são o destino do push e da faixa da Home.
 */
function DumpCards() {
  const cards = [
    {
      to: "/despertar" as const,
      icon: Sunrise,
      titulo: "Despertar",
      sub: "Registre o sonho antes que ele escape. Pode falar — a IA organiza.",
      cor: "border-amber-400/40 bg-amber-400/10 text-amber-400",
    },
    {
      to: "/dormir" as const,
      icon: Moon,
      titulo: "Dormir",
      sub: "Dump cru do dia. A IA organiza, registra e te devolve o resumo.",
      cor: "border-indigo-400/40 bg-indigo-500/10 text-indigo-400",
    },
  ];

  return (
    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Link
            key={c.to}
            to={c.to}
            className={`flex items-center gap-3 rounded-2xl border p-4 transition-colors ${c.cor}`}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-charcoal-900/60">
              <Icon className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg tracking-wide text-foreground">{c.titulo}</p>
              <p className="text-[11px] leading-snug text-muted-foreground">{c.sub}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Link>
        );
      })}
      <p className="text-[11px] text-muted-foreground lg:col-span-2">
        Os dumps aparecem sozinhos na Home nos seus horários de acordar e dormir. Ajuste em Perfil →
        Ritual diário.
      </p>
    </div>
  );
}
