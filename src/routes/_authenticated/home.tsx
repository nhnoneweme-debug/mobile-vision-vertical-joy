import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import { HUD } from "@/components/map/HUD";
import { MonthGlance } from "@/components/home/MonthGlance";
import { HabitTrackerStrip } from "@/components/home/HabitTrackerStrip";
import { TrackingShortcuts } from "@/components/home/TrackingShortcuts";
import { getTrack, rankFor } from "@/lib/level-tracks";
import { listMissions, maskToDays } from "@/lib/missions";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Início — Personal IA" },
      { name: "description", content: "Seu dia, hábitos e a Inteligência Digital num só lugar." },
    ],
  }),
  component: HomePage,
});

type Profile = {
  display_name: string;
  behavioral_class: string;
  xp: number;
  streak: number;
  brasas: number;
  level: string | null;
  level_track: string | null;
};

function HomePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [marked, setMarked] = useState<number[]>([]);
  const [activitiesByWeekday, setActivitiesByWeekday] = useState<Record<number, string[]>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid || !active) return;
      setUserId(uid);

      const { data: p } = await supabase
        .from("profiles")
        .select("display_name, behavioral_class, xp, streak, brasas, level, level_track")
        .eq("id", uid)
        .maybeSingle();
      if (p && active) setProfile(p as Profile);

      // Dias do mês com atividade registrada (para pontinhos no calendário)
      const now = new Date();
      const y = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const last = new Date(y, now.getMonth() + 1, 0).getDate();
      const { data: logs } = await supabase
        .from("habit_logs")
        .select("log_date")
        .gte("log_date", `${y}-${mm}-01`)
        .lte("log_date", `${y}-${mm}-${last}`);
      if (logs && active) {
        const days = Array.from(
          new Set(
            (logs as { log_date: string }[])
              .map((l) => Number((l.log_date || "").slice(8, 10)))
              .filter((n) => n > 0),
          ),
        );
        setMarked(days);
      }

      // Atividades por dia da semana (para descrição no calendário mensal)
      try {
        const missions = await listMissions(uid);
        if (active) {
          const map: Record<number, string[]> = {};
          for (const mi of missions) {
            for (const d of maskToDays(mi.weekday_mask)) {
              (map[d] ??= []).push(mi.title);
            }
          }
          setActivitiesByWeekday(map);
        }
      } catch {
        /* opcional */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const displayName = profile?.display_name ?? "Viajante";
  const behavioralClass = profile?.behavioral_class ?? "executor";
  const xp = profile?.xp ?? 0;
  const level = Math.max(1, Math.floor(xp / 500) + 1);
  const xpToNext = 500;
  const rankName = rankFor(getTrack(profile?.level_track), level);

  return (
    <MobileShell>
      <HUD
        displayName={displayName}
        behavioralClass={behavioralClass}
        level={level}
        xp={xp % xpToNext}
        xpToNext={xpToNext}
        streak={profile?.streak ?? 0}
        brasas={profile?.brasas ?? 0}
        rankName={rankName}
      />

      <MonthGlance marked={marked} activitiesByWeekday={activitiesByWeekday} />

      {userId && <HabitTrackerStrip userId={userId} />}

      <TrackingShortcuts />

      {/* respiro para o orbe central da IA */}
      <div className="h-28" />
    </MobileShell>
  );
}
