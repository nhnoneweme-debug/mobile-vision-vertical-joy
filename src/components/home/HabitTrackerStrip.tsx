import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Flame, Droplet, Dumbbell, Brain, Moon, Zap, Clipboard, Utensils,
  Sparkles, Trees, BookOpen, Heart, Eye, Check, Plus, Minus, Pin, type LucideIcon,
} from "lucide-react";
import { listHabits, incrementHabit, decrementHabit, FREQUENCY_META, type HabitWithMeta } from "@/lib/habits";

const ICONS: Record<string, LucideIcon> = {
  flame: Flame, droplet: Droplet, dumbbell: Dumbbell, brain: Brain, moon: Moon,
  zap: Zap, clipboard: Clipboard, utensils: Utensils, sparkles: Sparkles,
  trees: Trees, book: BookOpen, heart: Heart, eye: Eye,
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

const MAX_PINNED = 7;

export function HabitTrackerStrip({ userId }: { userId: string }) {
  const [habits, setHabits] = useState<HabitWithMeta[] | null>(null);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const storageKey = `habits.pinned.${userId}`;

  useEffect(() => {
    let active = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setPinned(new Set(JSON.parse(raw) as string[]));
    } catch { /* noop */ }
    listHabits(userId)
      .then((h) => active && setHabits(h))
      .catch(() => active && setHabits([]));
    return () => {
      active = false;
    };
  }, [userId, storageKey]);

  function togglePin(id: string) {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PINNED) next.add(id);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  }

  const all = habits ?? [];
  const displayed = (pinned.size > 0 ? all.filter((h) => pinned.has(h.id)) : all).slice(0, MAX_PINNED);

  return (
    <section className="px-4 pt-5">
      <header className="mb-3 flex items-center gap-3">
        <h2 className="font-display text-xl tracking-[0.16em] text-foreground">HÁBITOS</h2>
        <span className="h-px flex-1 bg-border" />
        {all.length > 0 && (
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="font-display text-[10px] tracking-[0.3em] text-ember active:opacity-70"
          >
            {editing ? "CONCLUIR" : "FIXAR"}
          </button>
        )}
        <Link
          to="/habitos"
          className="font-display text-[10px] tracking-[0.3em] text-muted-foreground active:opacity-70"
        >
          GERIR →
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
      ) : editing ? (
        <div className="space-y-2">
          <p className="mb-1 text-[11px] text-muted-foreground">
            Escolha até {MAX_PINNED} hábitos para fixar na Home ({pinned.size}/{MAX_PINNED}).
          </p>
          {all.map((h) => {
            const on = pinned.has(h.id);
            const Icon = ICONS[h.icon] ?? Flame;
            const disabled = !on && pinned.size >= MAX_PINNED;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => togglePin(h.id)}
                disabled={disabled}
                className={
                  "flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors disabled:opacity-40 " +
                  (on ? "border-ember/50 bg-ember/10" : "border-border bg-charcoal-900")
                }
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-charcoal-900 text-ember">
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-base tracking-wide text-foreground">
                  {h.title}
                </span>
                <Pin className={"h-5 w-5 shrink-0 " + (on ? "text-ember" : "text-muted-foreground")} strokeWidth={2.2} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2.5">
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
