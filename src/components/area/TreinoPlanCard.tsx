import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dumbbell, Sparkles, Trash2, Timer } from "lucide-react";
import {
  clearTrainingPlan,
  getTrainingPlan,
  parseTrainingPlan,
  type TrainingPlan,
} from "@/lib/treino.functions";

export function TreinoPlanCard() {
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fnGet = useServerFn(getTrainingPlan);
  const fnParse = useServerFn(parseTrainingPlan);
  const fnClear = useServerFn(clearTrainingPlan);

  useEffect(() => {
    (async () => {
      try {
        const p = await fnGet();
        setPlan(p);
        if (!p) setEditing(true);
        else setText(p.source_text);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [fnGet]);

  async function handleParse() {
    if (text.trim().length < 5) return;
    setSubmitting(true);
    try {
      const p = await fnParse({ data: { raw_text: text } });
      setPlan(p);
      setEditing(false);
      toast.success("Treino organizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClear() {
    setSubmitting(true);
    try {
      await fnClear();
      setPlan(null);
      setText("");
      setEditing(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="h-32 animate-pulse rounded-2xl border border-border bg-charcoal-900/50" />;
  }

  return (
    <div className="rounded-2xl border border-ember/30 bg-ember/5 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-ember" />
          <p className="font-display text-[10px] tracking-[0.3em] text-ember">
            TREINO ORGANIZADO PELA IA
          </p>
        </div>
        {plan && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-display text-[10px] tracking-[0.2em] text-muted-foreground hover:text-foreground"
          >
            EDITAR
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Cole sua planilha como ela vier. A IA detecta o split (ABC, PPL, Full Body…) e organiza por sessão.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            maxLength={6000}
            placeholder={"Ex: Treino A peito tríceps - supino reto 4x8-12, supino inclinado halter 3x10, crucifixo 3x12, tríceps polia 4x12, francês 3x10. Treino B costas bíceps - barra fixa 4xmax, remada curvada 4x8…"}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ember focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{text.length}/6000</span>
            <div className="flex gap-2">
              {plan && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setText(plan.source_text);
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 font-display text-[11px] tracking-[0.2em] text-muted-foreground"
                >
                  CANCELAR
                </button>
              )}
              <button
                type="button"
                onClick={handleParse}
                disabled={text.trim().length < 5 || submitting}
                className="flex items-center gap-1.5 rounded-lg bg-ember px-3 py-1.5 font-display text-[11px] tracking-[0.2em] text-charcoal-900 disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3" />
                {submitting ? "ORGANIZANDO…" : "ORGANIZAR"}
              </button>
            </div>
          </div>
        </div>
      ) : plan ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-md bg-background/60 px-2 py-1 font-display tracking-wider text-foreground">
              {plan.split}
            </span>
            <span>· {plan.days_per_week}x por semana</span>
          </div>

          <ul className="space-y-2">
            {plan.sessions.map((s, i) => (
              <li key={i} className="rounded-lg border border-border bg-background/50 p-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-sm tracking-wider text-ember">{s.day}</span>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    · {s.focus}
                  </span>
                </div>
                <ul className="mt-2 space-y-1">
                  {s.exercises.map((ex, j) => (
                    <li key={j} className="flex items-start justify-between gap-2 text-xs text-foreground/90">
                      <span className="flex-1">
                        <span className="font-medium">{ex.name}</span>
                        <span className="text-muted-foreground"> · {ex.sets}x{ex.reps}</span>
                        {ex.notes ? (
                          <span className="block text-[11px] italic text-muted-foreground">{ex.notes}</span>
                        ) : null}
                      </span>
                      {ex.rest_s ? (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Timer className="h-3 w-3" />
                          {ex.rest_s}s
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          {plan.warnings && plan.warnings.length > 0 && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-2 text-xs text-yellow-200/90">
              {plan.warnings.map((w, i) => (
                <p key={i}>⚠ {w}</p>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleClear}
            disabled={submitting}
            className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
            LIMPAR TREINO
          </button>
        </div>
      ) : null}
    </div>
  );
}
