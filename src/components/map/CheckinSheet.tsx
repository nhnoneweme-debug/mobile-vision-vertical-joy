import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { DailyQuestRow } from "@/lib/quests";

export function CheckinSheet({
  open,
  quest,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  quest: DailyQuestRow | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (effort: number, note: string) => void;
}) {
  const [effort, setEffort] = useState(3);
  const [note, setNote] = useState("");

  if (!quest) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        className="mx-auto max-w-[var(--shell-max)] rounded-t-3xl border-ember/20 bg-charcoal-900 px-5 pb-8 pt-6 text-foreground"
      >
        <SheetHeader className="text-left">
          <p className="font-display text-[10px] tracking-[0.4em] text-ember">
            CHECK-IN
          </p>
          <SheetTitle className="font-display text-2xl tracking-wide text-foreground">
            {quest.title}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {quest.subtitle}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
            ESFORÇO
          </p>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setEffort(n)}
                className={`rounded-xl border px-2 py-3 font-display text-xl tracking-wide transition-all ${
                  effort === n
                    ? "border-ember bg-ember/15 text-ember"
                    : "border-border bg-charcoal-800 text-muted-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
            NOTA (OPCIONAL)
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 140))}
            placeholder="Como foi?"
            rows={2}
            className="mt-2 w-full resize-none rounded-xl border border-border bg-charcoal-800 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ember/60"
          />
          <p className="mt-1 text-right text-[10px] text-muted-foreground">
            {note.length}/140
          </p>
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={() => onSubmit(effort, note)}
          className="ember-glow mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-ember bg-ember/15 px-6 py-4 font-display tracking-[0.2em] text-ember active:scale-[0.99] disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.4} />
          ) : (
            <Zap className="h-5 w-5" strokeWidth={2.5} />
          )}
          CONFIRMAR · +{quest.xp_reward} XP
        </button>
      </SheetContent>
    </Sheet>
  );
}
