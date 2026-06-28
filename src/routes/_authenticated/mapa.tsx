import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import { HUD } from "@/components/map/HUD";
import { QuestOfDayCard } from "@/components/map/QuestOfDayCard";
import { BentoArea } from "@/components/map/BentoArea";
import { AREAS } from "@/components/map/areas";
import { buildDailyQuest } from "@/lib/quest";

export const Route = createFileRoute("/_authenticated/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa — Personal IA" },
      { name: "description", content: "Seu mundo Personal IA: missões, treino, sono e mente." },
    ],
  }),
  component: MapaPage,
});

type Profile = {
  display_name: string;
  behavioral_class: string;
  xp: number;
  streak: number;
  goal: string | null;
  level: string | null;
  time_per_day_min: number | null;
};

function MapaPage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, behavioral_class, xp, streak, goal, level, time_per_day_min")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (active && data) setProfile(data as Profile);
    })();
    return () => {
      active = false;
    };
  }, []);

  const displayName = profile?.display_name ?? "Viajante";
  const behavioralClass = profile?.behavioral_class ?? "executor";
  const xp = profile?.xp ?? 0;
  const streak = profile?.streak ?? 0;
  const level = Math.max(1, Math.floor(xp / 500) + 1);
  const xpToNext = 500;

  const quest = buildDailyQuest({
    goal: profile?.goal,
    level: profile?.level,
    time_per_day_min: profile?.time_per_day_min,
    behavioral_class: behavioralClass,
  });

  return (
    <MobileShell>
      <HUD
        displayName={displayName}
        behavioralClass={behavioralClass}
        level={level}
        xp={xp % xpToNext}
        xpToNext={xpToNext}
        streak={streak}
      />

      <div className="px-4 pt-4">
        <QuestOfDayCard quest={quest} />
      </div>

      <section className="px-4 pb-6 pt-5">
        <header className="mb-3 flex items-center gap-3">
          <h2 className="font-display text-xl tracking-[0.18em] text-foreground">
            SEU MUNDO
          </h2>
          <span className="h-px flex-1 bg-border" />
          <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
            10 ÁREAS
          </span>
        </header>

        <div className="grid auto-rows-[120px] grid-cols-4 gap-3">
          {AREAS.map((area) => (
            <BentoArea key={area.slug} area={area} />
          ))}
        </div>
      </section>
    </MobileShell>
  );
}
