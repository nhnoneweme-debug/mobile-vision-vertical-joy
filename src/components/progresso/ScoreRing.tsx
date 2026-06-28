export function ScoreRing({
  score,
  delta,
}: {
  score: number;
  delta?: number | null;
}) {
  const max = 1000;
  const pct = Math.max(0, Math.min(1, score / max));
  const size = 220;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--charcoal-800)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--ember)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 800ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
          PERSONAL IA SCORE
        </span>
        <span className="font-display text-6xl leading-none text-foreground">
          {score}
        </span>
        <span className="mt-1 font-display text-[10px] tracking-[0.3em] text-muted-foreground">
          / 1000
        </span>
        {typeof delta === "number" && delta !== 0 && (
          <span
            className={
              "mt-2 rounded-full px-2 py-0.5 font-display text-[10px] tracking-[0.2em] " +
              (delta > 0
                ? "bg-ember/15 text-ember"
                : "bg-charcoal-800 text-muted-foreground")
            }
          >
            {delta > 0 ? "+" : ""}
            {delta} vs semana passada
          </span>
        )}
      </div>
    </div>
  );
}
