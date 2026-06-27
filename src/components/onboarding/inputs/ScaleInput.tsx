type Props = {
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
};

export function ScaleInput({
  value,
  onChange,
  min = 1,
  max = 5,
  minLabel,
  maxLabel,
}: Props) {
  const dots = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div>
      <div className="flex gap-2">
        {dots.map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`flex-1 rounded-xl border px-2 py-4 font-display text-xl tracking-wide transition-transform active:scale-95 ${
                active
                  ? "ember-glow border-ember bg-ember text-primary-foreground"
                  : "border-border bg-charcoal-900 text-muted-foreground"
              }`}
              aria-label={`Nível ${n}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      {(minLabel || maxLabel) && (
        <div className="mt-2 flex justify-between font-display text-[10px] tracking-[0.25em] text-muted-foreground">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}
