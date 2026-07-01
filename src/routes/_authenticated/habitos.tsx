import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import { HabitRow } from "@/components/habits/HabitRow";
import { HabitForm } from "@/components/habits/HabitForm";
import { XPToast } from "@/components/map/XPToast";
import {
  archiveHabit,
  createHabit,
  listHabits,
  toggleHabit,
  type HabitWithMeta,
} from "@/lib/habits";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/habitos")({
  head: () => ({
    meta: [
      { title: "Hábitos — Personal IA" },
      { name: "description", content: "Seus rituais diários e streaks individuais." },
    ],
  }),
  component: HabitosPage,
});

function HabitosPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [habits, setHabits] = useState<HabitWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [xpToast, setXpToast] = useState<{ amount: number; leveledUp: boolean } | null>(null);

  const refresh = useCallback(async (uid: string) => {
    const list = await listHabits(uid);
    setHabits(list);
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
        className="sticky top-0 z-30 border-b border-border bg-charcoal-900/85 px-4 pb-4 pt-5 backdrop-blur-xl"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
      >
        <p className="font-display text-[10px] tracking-[0.3em] text-ember">RITUAIS</p>
        <h1 className="mt-1 font-display text-4xl tracking-wide text-foreground">Hábitos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {habits.length === 0
            ? "Crie hábitos para acender sua chama diária."
            : `${doneToday} de ${habits.length} feitos hoje · +10 XP cada`}
        </p>
      </section>

      <div className="space-y-3 px-4 py-5 pb-32">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            {habits.map((h) => (
              <HabitRow
                key={h.id}
                habit={h}
                pending={pending === h.id}
                onToggle={() => handleToggle(h)}
                onArchive={() => handleArchive(h)}
              />
            ))}
            <HabitForm onSubmit={handleCreate} pending={false} />
          </>
        )}
      </div>

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
