import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trophy, X } from "lucide-react";
import {
  getEligibleChallengesForToday,
  checkinToChallenge,
  type Challenge,
} from "@/lib/challenges";

type Props = {
  workoutSessionId?: string | null;
  open: boolean;
  onClose: () => void;
};

/**
 * Sheet que aparece após concluir um treino: lista desafios elegíveis para
 * check-in de hoje e permite confirmar os selecionados de uma vez.
 * Nada é feito se não houver desafios elegíveis (fecha silenciosamente).
 */
export function PostWorkoutCheckinSheet({ workoutSessionId, open, onClose }: Props) {
  const [items, setItems] = useState<Challenge[] | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    getEligibleChallengesForToday()
      .then((list) => {
        if (!alive) return;
        setItems(list);
        const init: Record<string, boolean> = {};
        list.forEach((c) => (init[c.id] = true));
        setChecked(init);
        if (list.length === 0) onClose();
      })
      .catch(() => {
        if (alive) onClose();
      });
    return () => {
      alive = false;
    };
  }, [open, onClose]);

  if (!open || !items || items.length === 0) return null;

  async function confirm() {
    if (!items) return;
    setBusy(true);
    let ok = 0;
    for (const c of items) {
      if (!checked[c.id]) continue;
      try {
        await checkinToChallenge({ challengeId: c.id, workoutSessionId });
        ok++;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro no check-in");
      }
    }
    setBusy(false);
    if (ok > 0) toast.success(`Check-in registrado em ${ok} desafio${ok > 1 ? "s" : ""}.`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-[var(--shell-max,480px)] rounded-t-3xl border border-border bg-charcoal-900 p-4 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-ember" />
          <h3 className="flex-1 font-display text-base tracking-wide text-foreground">
            Registrar check-in
          </h3>
          <button type="button" onClick={onClose} className="text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Vincule este treino aos desafios ativos:
        </p>
        <div className="space-y-2">
          {items.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-charcoal-800 px-3 py-2.5"
            >
              <input
                type="checkbox"
                checked={!!checked[c.id]}
                onChange={(e) => setChecked((p) => ({ ...p, [c.id]: e.target.checked }))}
                className="h-4 w-4 accent-ember"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm text-foreground">{c.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {c.group_name ?? "Grupo"} · {c.metric}
                </p>
              </div>
            </label>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-charcoal-800 py-2.5 text-sm text-muted-foreground"
          >
            Depois
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="flex-1 rounded-xl bg-ember py-2.5 font-display text-sm text-charcoal-900 disabled:opacity-50 active:scale-[0.99]"
          >
            {busy ? "..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
