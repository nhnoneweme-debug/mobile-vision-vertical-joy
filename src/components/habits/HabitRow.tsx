import { Flame, Check, Zap, Droplet, Dumbbell, Clipboard, Sparkles, Moon, Heart, Utensils, Book, Trees, Eye, type LucideIcon, Trash2 } from "lucide-react";
import type { HabitWithMeta } from "@/lib/habits";

const ICONS: Record<string, LucideIcon> = {
  flame: Flame, zap: Zap, droplet: Droplet, dumbbell: Dumbbell,
  clipboard: Clipboard, sparkles: Sparkles, moon: Moon, heart: Heart,
  utensils: Utensils, book: Book, trees: Trees, eye: Eye,
};

export function HabitRow({
  habit,
  onToggle,
  onArchive,
  pending,
}: {
  habit: HabitWithMeta;
  onToggle: () => void;
  onArchive: () => void;
  pending: boolean;
}) {
  const Icon = ICONS[habit.icon] ?? Flame;
  const done = habit.done_today;

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
        done
          ? "border-ember/50 bg-charcoal-800/80"
          : "border-border bg-charcoal-900/60"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        aria-label={done ? "Desfazer hábito" : "Marcar hábito"}
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border transition-all ${
          done
            ? "border-ember bg-ember text-primary-foreground ember-glow"
            : "border-border bg-charcoal-800 text-muted-foreground active:scale-95"
        } disabled:opacity-50`}
      >
        {done ? <Check className="h-5 w-5" strokeWidth={3} /> : <Icon className="h-5 w-5" strokeWidth={2.2} />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`truncate font-display text-lg tracking-wide ${done ? "text-foreground" : "text-foreground/90"}`}>
          {habit.title}
        </p>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Flame className={`h-3 w-3 ${habit.streak > 0 ? "text-ember" : ""}`} strokeWidth={2.5} />
            <span className="font-display tracking-[0.18em]">{habit.streak}d</span>
          </span>
          <span className="font-display tracking-[0.18em]">
            {habit.week_done}/{habit.target_per_week} sem
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onArchive}
        aria-label="Arquivar hábito"
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground/60 hover:text-ember"
      >
        <Trash2 className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
