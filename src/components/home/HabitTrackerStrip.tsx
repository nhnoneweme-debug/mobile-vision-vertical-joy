import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Flame,
  Droplet,
  Dumbbell,
  Brain,
  Moon,
  Zap,
  Clipboard,
  Utensils,
  Sparkles,
  Trees,
  BookOpen,
  Heart,
  Eye,
  Check,
  Plus,
  Minus,
  type LucideIcon,
} from "lucide-react";
import {
  listHabits,
  incrementHabit,
  decrementHabit,
  homeHabits,
  migrateLegacyPins,
  FREQUENCY_META,
  type HabitWithMeta,
} from "@/lib/habits";

const ICONS: Record<string, LucideIcon> = {
  flame: Flame,
  droplet: Droplet,
  dumbbell: Dumbbell,
  brain: Brain,
  moon: Moon,
  zap: Zap,
  clipboard: Clipboard,
  utensils: Utensils,
  sparkles: Sparkles,
  trees: Trees,
  book: BookOpen,
  heart: Heart,
  eye: Eye,
};

function HabitRowItem({
  habit,
  userId,
  onChange,
}: {
  habit: HabitWithMeta;
  userId: string;
  onChange: (h: HabitWithMeta) => void;
}) {
  const [busy, setBusy] = useState(false);
  const Icon = ICONS[habit.icon] ?? Flame;
  const target = Math.max(1, habit.period_target || 1);
  const done = Math.min(target, habit.period_done);
  const full = done >= target;
  const freqMeta = FREQUENCY_META[habit.freq] ?? FREQUENCY_META.weekly;

  async function handleAdd() {
    if (busy || full) return;
    setBusy(true);
    const optimistic: HabitWithMeta = {
      ...habit,
      done_today: true,
      period_done: Math.min(target, habit.period_done + 1),
    };
    onChange(optimistic);
    try {
      const okAdded = await incrementHabit(userId, habit);
      if (!okAdded) onChange(habit); // já estava no máximo
    } catch {
      onChange(habit); // reverte
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (busy || done <= 0) return;
    setBusy(true);
    const nextDone = Math.max(0, habit.period_done - 1);
    const optimistic: HabitWithMeta = {
      ...habit,
      period_done: nextDone,
      done_today: nextDone > 0 ? habit.done_today : false,
    };
    onChange(optimistic);
    try {
      const okRemoved = await decrementHabit(userId, habit);
      if (!okRemoved) onChange(habit); // nada para desfazer
    } catch {
      onChange(habit); // reverte
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="forge-card flex items-center gap-3 rounded-2xl px-3.5 py-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-charcoal-900 text-ember">
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-display text-base leading-tight tracking-wide text-foreground">
            {habit.title}
          </p>
          <span className="shrink-0 rounded-md border border-ember/30 bg-ember/10 px-1.5 py-0.5 font-display text-[9px] tracking-[0.15em] text-ember">
            {freqMeta.short}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          {Array.from({ length: target }).map((_, i) => (
            <span
              key={i}
              className={
                "h-1.5 flex-1 rounded-full " +
                (i < done ? "bg-gradient-to-r from-ember to-ember-glow" : "bg-charcoal-700")
              }
            />
          ))}
          <span className="ml-1.5 font-display text-[10px] tracking-[0.2em] text-muted-foreground">
            {done}/{target}
          </span>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {freqMeta.label} · {habit.resets_in}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {done > 0 && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            aria-label="Desfazer um registro"
            className="forge-press grid h-9 w-9 place-items-center rounded-xl border border-border bg-charcoal-900 text-muted-foreground active:forge-press-active disabled:active:scale-100"
          >
            <Minus className="h-4 w-4" strokeWidth={2.4} />
          </button>
        )}
        <button
          type="button"
          onClick={handleAdd}
          disabled={full || busy}
          aria-label={full ? "Meta concluída" : "Registrar +1"}
          className={
            "forge-press grid h-11 w-11 place-items-center rounded-xl border active:forge-press-active disabled:active:scale-100 " +
            (full
              ? "border-ember/40 bg-ember text-charcoal-900 ember-glow"
              : "border-border bg-charcoal-900 text-ember")
          }
        >
          {full ? (
            <Check className="h-5 w-5 stamp-in" strokeWidth={3} />
          ) : (
            <Plus className="h-5 w-5" strokeWidth={2.4} />
          )}
        </button>
      </div>
    </div>
  );
}

export function HabitTrackerStrip({ userId }: { userId: string }) {
  const [habits, setHabits] = useState<HabitWithMeta[] | null>(null);

  // A Home só EXIBE o que foi fixado — escolher quais é na aba Hábitos.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let list = await listHabits(userId);
        // Pins antigos viviam no localStorage; sobe pro banco uma vez.
        if (await migrateLegacyPins(userId, list)) list = await listHabits(userId);
        if (active) setHabits(list);
      } catch {
        if (active) setHabits([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const all = habits ?? [];
  const displayed = homeHabits(all);

  return (
    <section className="px-4 pt-5">
      <header className="mb-3 flex items-center gap-3">
        <h2 className="font-display text-xl tracking-[0.16em] text-foreground">HÁBITOS</h2>
        <span className="h-px flex-1 bg-border" />
        <Link
          to="/habitos"
          className="font-display text-[10px] tracking-[0.3em] text-muted-foreground active:opacity-70"
        >
          ABRIR →
        </Link>
      </header>

      {habits === null ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-charcoal-800" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <Link
          to="/habitos"
          className="forge-card flex items-center justify-center gap-2 rounded-2xl px-4 py-6 text-muted-foreground active:forge-press-active"
        >
          <Plus className="h-4 w-4" />
          <span className="font-display text-sm tracking-wide">Criar seu primeiro hábito</span>
        </Link>
      ) : (
        <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-2.5 lg:space-y-0">
          {displayed.map((h) => (
            <HabitRowItem
              key={h.id}
              habit={h}
              userId={userId}
              onChange={(next) =>
                setHabits((prev) => (prev ? prev.map((x) => (x.id === next.id ? next : x)) : prev))
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
