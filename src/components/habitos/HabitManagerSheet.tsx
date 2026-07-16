import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { HabitForm } from "@/components/habits/HabitForm";
import { Archive } from "lucide-react";
import type { HabitWithMeta } from "@/lib/habits";

/**
 * Gerenciar hábitos — criar e arquivar.
 *
 * Aberto pelo próprio título "Hábitos" da tela: o gerenciamento é sobre a
 * coleção, então mora no nome dela em vez de um botão solto.
 */
export function HabitManagerSheet({
  open,
  onOpenChange,
  habits,
  onCreate,
  onArchive,
  pendingId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  habits: HabitWithMeta[];
  onCreate: (input: { title: string; icon: string; target_per_week: number }) => Promise<void>;
  onArchive: (h: HabitWithMeta) => Promise<void>;
  pendingId: string | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[85vh] max-w-[var(--shell-max)] flex-col rounded-t-2xl border-border bg-charcoal-900/95 backdrop-blur-xl"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display tracking-[0.18em] text-foreground">
            GERENCIAR HÁBITOS
          </SheetTitle>
        </SheetHeader>

        <div
          className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pb-6"
          data-lenis-prevent
        >
          <div>
            <p className="mb-2 font-display text-[11px] tracking-[0.22em] text-muted-foreground">
              NOVO HÁBITO
            </p>
            <HabitForm onSubmit={onCreate} pending={false} />
          </div>

          {habits.length > 0 && (
            <div>
              <p className="mb-2 font-display text-[11px] tracking-[0.22em] text-muted-foreground">
                ARQUIVAR
              </p>
              <div className="flex flex-col gap-1.5">
                {habits.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground/90">
                      {h.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => onArchive(h)}
                      disabled={pendingId === h.id}
                      aria-label={`Arquivar ${h.title}`}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                    >
                      <Archive className="h-4 w-4" strokeWidth={2.2} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Arquivar tira o hábito da lista e solta a vaga dele na Home. O histórico fica.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
