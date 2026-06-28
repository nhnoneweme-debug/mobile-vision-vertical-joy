export function Sparkline({
  points,
  height = 56,
}: {
  points: number[];
  height?: number;
}) {
  const w = 320;
  if (points.length < 2) {
    return (
      <div
        className="rounded-xl border border-dashed border-border bg-charcoal-900/50 px-3 py-4 text-center"
        style={{ height }}
      >
        <span className="font-display text-[10px] tracking-[0.25em] text-muted-foreground">
          AINDA SEM HISTÓRICO
        </span>
      </div>
    );
  }
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 1000);
  const range = Math.max(1, max - min);
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / range) * (height - 8) - 4;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const last = points[points.length - 1];
  const lastX = (points.length - 1) * step;
  const lastY = height - ((last - min) / range) * (height - 8) - 4;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full">
      <path
        d={path}
        fill="none"
        stroke="var(--ember)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={4} fill="var(--ember)" />
    </svg>
  );
}
