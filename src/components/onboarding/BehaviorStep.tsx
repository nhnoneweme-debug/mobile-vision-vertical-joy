import { BEHAVIOR_QUESTIONS } from "@/lib/behavior";
import { ScaleInput } from "./inputs/ScaleInput";

type Props = {
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
};

export function BehaviorStep({ value, onChange }: Props) {
  return (
    <div className="space-y-5 pt-4">
      <p className="rounded-xl border border-border bg-charcoal-900 p-3 text-xs text-muted-foreground">
        Responda de 1 (discordo) a 5 (concordo). O Oráculo usa isso para revelar
        sua classe.
      </p>
      {BEHAVIOR_QUESTIONS.map((q, i) => (
        <div
          key={q.id}
          className="rounded-2xl border border-border bg-card p-4"
        >
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xs tracking-[0.3em] text-ember">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="text-base text-foreground">{q.prompt}</p>
          </div>
          <div className="mt-3">
            <ScaleInput
              value={value[q.id]}
              onChange={(v) => onChange({ ...value, [q.id]: v })}
              minLabel="DISCORDO"
              maxLabel="CONCORDO"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
