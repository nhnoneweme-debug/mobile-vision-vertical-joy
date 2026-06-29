import { useEffect, useState } from "react";
import { Award, Flame, Sparkles, Crown, Calendar, Sprout, Sunrise, Compass, Users, ShoppingBag, TowerControl } from "lucide-react";
import { RARITY_STYLES, type UnlockedAchievement } from "@/lib/achievements";

const ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  flame: Flame,
  sparkles: Sparkles,
  crown: Crown,
  calendar: Calendar,
  sprout: Sprout,
  sunrise: Sunrise,
  compass: Compass,
  users: Users,
  "shopping-bag": ShoppingBag,
  "tower-control": TowerControl,
  award: Award,
};

export function AchievementToast({
  achievement,
  onDone,
}: {
  achievement: UnlockedAchievement;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const style = RARITY_STYLES[achievement.rarity];
  const Icon = ICONS[achievement.icon] ?? Award;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => setVisible(false), 4200);
    const end = setTimeout(onDone, 4700);
    return () => {
      clearTimeout(t);
      clearTimeout(end);
    };
  }, [onDone]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center px-4"
      aria-live="polite"
    >
      <div
        className={`flex w-full max-w-[420px] items-start gap-3 rounded-2xl border bg-charcoal-900/95 p-4 ring-2 backdrop-blur transition-all duration-500 ${style.ring} ${
          visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
        }`}
      >
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${style.bg}`}>
          <Icon className={`h-6 w-6 ${style.text}`} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`font-display text-[10px] tracking-[0.3em] ${style.text}`}>
            CONQUISTA · {style.label}
          </p>
          <p className="mt-1 font-display text-lg leading-tight tracking-wide text-foreground">
            {achievement.title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{achievement.description}</p>
          {(achievement.xp_reward > 0 || achievement.brasas_reward > 0) && (
            <div className="mt-2 flex gap-3 font-display text-[11px] tracking-[0.2em] text-ember">
              {achievement.xp_reward > 0 && <span>+{achievement.xp_reward} XP</span>}
              {achievement.brasas_reward > 0 && <span>+{achievement.brasas_reward} BRASAS</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
