import { Minus, Plus } from "lucide-react";

type Props = {
  value: number | undefined;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  placeholder?: number;
};

export function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  placeholder,
}: Props) {
  const current = value ?? placeholder ?? min;
  const dec = () => onChange(Math.max(min, current - step));
  const inc = () => onChange(Math.min(max, current + step));
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-charcoal-900 p-2">
      <button
        type="button"
        onClick={dec}
        className="grid h-11 w-11 place-items-center rounded-lg bg-charcoal-800 text-ember active:scale-95"
        aria-label="Diminuir"
      >
        <Minus className="h-5 w-5" strokeWidth={2.5} />
      </button>
      <div className="flex flex-1 items-baseline justify-center gap-1">
        <span className="font-display text-4xl text-foreground">{current}</span>
        {suffix && (
          <span className="font-display text-xs tracking-[0.25em] text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={inc}
        className="grid h-11 w-11 place-items-center rounded-lg bg-charcoal-800 text-ember active:scale-95"
        aria-label="Aumentar"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
