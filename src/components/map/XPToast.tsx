import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

export function XPToast({
  amount,
  leveledUp,
  onDone,
}: {
  amount: number;
  leveledUp: boolean;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => setVisible(false), 1800);
    const end = setTimeout(onDone, 2200);
    return () => {
      clearTimeout(t);
      clearTimeout(end);
    };
  }, [onDone]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center px-6"
      aria-live="polite"
    >
      <div
        className={`ember-glow flex items-center gap-2 rounded-full border border-ember/40 bg-charcoal-900/95 px-5 py-3 backdrop-blur transition-all duration-500 ${
          visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
        }`}
      >
        <Zap className="h-4 w-4 text-ember" strokeWidth={2.5} />
        <span className="font-display text-lg tracking-[0.2em] text-ember">
          +{amount} XP
        </span>
        {leveledUp && (
          <span className="ml-2 rounded-md border border-ember bg-ember/10 px-2 py-0.5 font-display text-[10px] tracking-[0.3em] text-ember">
            NÍVEL UP
          </span>
        )}
      </div>
    </div>
  );
}
