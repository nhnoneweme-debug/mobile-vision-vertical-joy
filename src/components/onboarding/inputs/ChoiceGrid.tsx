type Option = { value: string; label: string; hint?: string };

type Props = {
  options: Option[];
  value: string | undefined;
  onChange: (v: string) => void;
  columns?: 1 | 2;
};

export function ChoiceGrid({ options, value, onChange, columns = 2 }: Props) {
  return (
    <div className={`grid gap-2 ${columns === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-xl border p-3 text-left transition-transform active:scale-[0.98] ${
              active
                ? "ember-glow border-ember bg-charcoal-800"
                : "border-border bg-charcoal-900"
            }`}
          >
            <div
              className={`font-display text-base tracking-wide ${
                active ? "text-ember" : "text-foreground"
              }`}
            >
              {opt.label}
            </div>
            {opt.hint && (
              <div className="mt-0.5 text-xs text-muted-foreground">{opt.hint}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
