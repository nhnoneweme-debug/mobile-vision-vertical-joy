// Relógio grande com segundos, tick de 1s. Dá sensação de "ao vivo" na tela.

import { useEffect, useState } from "react";

function fmt(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(
    d.getSeconds(),
  ).padStart(2, "0")}`;
}

export function LiveClock({ label }: { label?: string }) {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-3">
      <span className="relative inline-flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember/60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ember" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {label ?? "Execução ao vivo"}
        </p>
        <p className="font-display text-3xl leading-none tracking-[0.08em] text-foreground tabular-nums">
          {fmt(now)}
        </p>
      </div>
    </div>
  );
}
