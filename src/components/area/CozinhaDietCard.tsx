import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UtensilsCrossed, Sparkles, Trash2, Droplet, Clock } from "lucide-react";
import { clearDietPlan, getDietPlan, parseDietPlan, type DietPlan } from "@/lib/cozinha.functions";

export function CozinhaDietCard() {
  const [plan, setPlan] = useState<DietPlan | null>(null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fnGet = useServerFn(getDietPlan);
  const fnParse = useServerFn(parseDietPlan);
  const fnClear = useServerFn(clearDietPlan);

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
      toast.success("Dieta organizada");
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
          <UtensilsCrossed className="h-4 w-4 text-ember" />
          <p className="font-display text-[10px] tracking-[0.3em] text-ember">
            DIETA ORGANIZADA PELA IA
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
            Cole sua dieta como ela vier — texto bagunçado tudo bem. A IA vai organizar em refeições com horários.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={4000}
            placeholder="Ex: café 7h ovos mexidos com pão integral, café com leite. 10h fruta. almoço 12h30 arroz integral, feijão, frango grelhado, salada. lanche 16h whey. jantar 20h…"
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ember focus:outline-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{text.length}/4000</span>
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
        <div className="mt-3 space-y-2">
          {plan.hydration_ml ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2">
              <Droplet className="h-3.5 w-3.5 text-ember" />
              <p className="text-xs text-foreground">
                Meta de hidratação: <span className="font-semibold">{plan.hydration_ml} ml/dia</span>
              </p>
            </div>
          ) : null}

          <ul className="space-y-2">
            {plan.meals.map((m, i) => (
              <li key={i} className="rounded-lg border border-border bg-background/50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-ember" />
                    <span className="font-display text-sm tracking-wide text-foreground">
                      {m.time}
                    </span>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      · {m.name}
                    </span>
                  </div>
                </div>
                <ul className="mt-1.5 ml-5 list-disc text-xs text-foreground/90 marker:text-ember/50">
                  {m.items.map((it, j) => (
                    <li key={j}>{it}</li>
                  ))}
                </ul>
                {m.notes ? (
                  <p className="ml-5 mt-1 text-[11px] italic text-muted-foreground">{m.notes}</p>
                ) : null}
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
            LIMPAR DIETA
          </button>
        </div>
      ) : null}
    </div>
  );
}
