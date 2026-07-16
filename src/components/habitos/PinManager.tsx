import { useState } from "react";
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
  Pin,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { MAX_PINNED, setHabitPinned, sortByPin, type HabitWithMeta } from "@/lib/habits";

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

/** Escolhe quais hábitos aparecem na Home. Antes isso vivia na própria Home. */
export function PinManager({
  habits,
  onChanged,
}: {
  habits: HabitWithMeta[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const pinnedCount = habits.filter((h) => h.pinned_at).length;

  async function toggle(h: HabitWithMeta) {
    const on = !!h.pinned_at;
    if (!on && pinnedCount >= MAX_PINNED) return;
    setBusy(h.id);
    try {
      await setHabitPinned(h.id, !on);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui fixar");
    } finally {
      setBusy(null);
    }
  }

  if (habits.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-charcoal-900 px-4 py-8 text-center text-sm text-muted-foreground">
        Crie um hábito primeiro — depois escolha quais aparecem na Home.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        Escolha até {MAX_PINNED} hábitos para a Home ({pinnedCount}/{MAX_PINNED}). Sem nenhum
        fixado, a Home mostra os {MAX_PINNED} primeiros.
      </p>
      <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
        {sortByPin(habits).map((h) => {
          const on = !!h.pinned_at;
          const Icon = ICONS[h.icon] ?? Flame;
          const disabled = (!on && pinnedCount >= MAX_PINNED) || busy === h.id;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => toggle(h)}
              disabled={disabled}
              aria-pressed={on}
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
              <Pin
                className={"h-5 w-5 shrink-0 " + (on ? "text-ember" : "text-muted-foreground")}
                strokeWidth={2.2}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
