import { CLASS_META, type BehavioralClass, type BehaviorScores } from "@/lib/behavior";
import { ArrowRight, Loader2 } from "lucide-react";

type Props = {
  classId: BehavioralClass;
  scores: BehaviorScores;
  onEnter: () => void;
  loading?: boolean;
};

export function OracleReveal({ classId, scores, onEnter, loading }: Props) {
  const meta = CLASS_META[classId];
  const max = Math.max(...Object.values(scores), 1);

  return (
    <div className="flex flex-1 flex-col px-4 pb-6 pt-2">
      <div className="ember-pulse mx-auto grid h-32 w-32 place-items-center rounded-full border border-ember/40 bg-charcoal-900">
        <span className="text-5xl">{meta.emblem}</span>
      </div>

      <div className="mt-6 text-center">
        <p className="font-display text-[10px] tracking-[0.4em] text-ember">
          O ORÁCULO REVELA
        </p>
        <h2 className="mt-2 font-display text-5xl tracking-wide text-foreground">
          {meta.name.toUpperCase()}
        </h2>
        <p className="mt-2 font-display text-xs tracking-[0.3em] text-muted-foreground">
          {meta.tagline}
        </p>
      </div>

      <p className="mt-6 rounded-2xl border border-border bg-card p-4 text-center text-sm leading-relaxed text-foreground">
        {meta.description}
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
          SEUS EIXOS
        </p>
        <div className="mt-3 space-y-2">
          {(Object.entries(scores) as [keyof BehaviorScores, number][]).map(
            ([axis, v]) => (
              <div key={axis} className="flex items-center gap-3">
                <span className="w-24 font-display text-[11px] tracking-[0.25em] text-muted-foreground">
                  {axis.toUpperCase()}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-charcoal-900">
                  <div
                    className="h-full rounded-full bg-ember"
                    style={{ width: `${Math.max(8, (v / max) * 100)}%` }}
                  />
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onEnter}
        disabled={loading}
        className="ember-glow mt-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-display text-lg tracking-widest text-primary-foreground disabled:opacity-60"
        style={{ marginTop: "1.5rem" }}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            ENTRAR NO MUNDO
            <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
          </>
        )}
      </button>
    </div>
  );
}
