import { createFileRoute, Link } from "@tanstack/react-router";
import { Sunrise, Moon, CalendarDays } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/shell/MobileShell";
import { HUD } from "@/components/map/HUD";
import { QuestOfDayCard } from "@/components/map/QuestOfDayCard";
import { CheckinSheet } from "@/components/map/CheckinSheet";
import { XPToast } from "@/components/map/XPToast";
import { BentoArea } from "@/components/map/BentoArea";
import { AREAS } from "@/components/map/areas";
import {
  completeQuest,
  ensureTodayQuest,
  type DailyQuestRow,
} from "@/lib/quests";
import { areaLevelProgress, listAllAreaProgress, type AreaProgress } from "@/lib/area-missions";
import { toast } from "sonner";


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
  brasas: number;
  goal: string | null;
  level: string | null;
  time_per_day_min: number | null;
};

function MapaPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [quest, setQuest] = useState<DailyQuestRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [xpToast, setXpToast] = useState<{ amount: number; leveledUp: boolean } | null>(null);
  const [areaProgress, setAreaProgress] = useState<Record<string, AreaProgress>>({});


  const loadProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, behavioral_class, xp, streak, brasas, goal, level, time_per_day_min")
      .eq("id", uid)
      .maybeSingle();
    if (data) setProfile(data as Profile);
    return data as Profile | null;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      if (!active) return;
      setUserId(userData.user.id);
      const p = await loadProfile(userData.user.id);
      if (!p || !active) return;
      try {
        const q = await ensureTodayQuest(userData.user.id, {
          goal: p.goal,
          level: p.level,
          time_per_day_min: p.time_per_day_min,
          behavioral_class: p.behavioral_class,
        });
        if (active) setQuest(q);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Falha ao carregar quest";
        toast.error(msg);
      }
      try {
        const rows = await listAllAreaProgress(userData.user.id);
        if (active) {
          setAreaProgress(
            Object.fromEntries(rows.map((r) => [r.area_slug, r])),
          );
        }
      } catch {
        /* non-blocking */
      }
    })();
    return () => {
      active = false;
    };
  }, [loadProfile]);


  async function handleSubmitCheckin(effort: number, note: string) {
    if (!quest || !userId || submitting) return;
    setSubmitting(true);
    const prevXP = profile?.xp ?? 0;
    const prevLevel = Math.floor(prevXP / 500) + 1;
    try {
      const updated = await completeQuest(quest.id, effort, note);
      setQuest(updated);
      setSheetOpen(false);
      const p = await loadProfile(userId);
      const newLevel = Math.floor((p?.xp ?? prevXP) / 500) + 1;
      setXpToast({
        amount: updated.xp_reward,
        leveledUp: newLevel > prevLevel,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro no check-in";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const displayName = profile?.display_name ?? "Viajante";
  const behavioralClass = profile?.behavioral_class ?? "executor";
  const xp = profile?.xp ?? 0;
  const streak = profile?.streak ?? 0;
  const level = Math.max(1, Math.floor(xp / 500) + 1);
  const xpToNext = 500;

  return (
    <MobileShell>
      <HUD
        displayName={displayName}
        behavioralClass={behavioralClass}
        level={level}
        xp={xp % xpToNext}
        xpToNext={xpToNext}
        streak={streak}
        brasas={profile?.brasas ?? 0}
      />

      <div className="px-4 pt-4">
        {quest ? (
          <QuestOfDayCard quest={quest} onCheckin={() => setSheetOpen(true)} />
        ) : (
          <div className="h-32 animate-pulse rounded-2xl border border-border bg-charcoal-800" />
        )}
      </div>

      <Link
        to="/ritual"
        className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-ember/30 bg-card px-4 py-3 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-charcoal-900 text-ember">
            {new Date().getHours() < 17 ? (
              <Sunrise className="h-5 w-5" strokeWidth={2.2} />
            ) : (
              <Moon className="h-5 w-5" strokeWidth={2.2} />
            )}
          </div>
          <div>
            <p className="font-display text-[10px] tracking-[0.3em] text-ember">
              RITUAL DIÁRIO
            </p>
            <p className="font-display text-base tracking-wide text-foreground">
              {new Date().getHours() < 17 ? "Abrir o dia" : "Fechar o dia"} · +25 XP
            </p>
          </div>
        </div>
        <span className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
          ABRIR →
        </span>
      </Link>

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
          {AREAS.map((area) => {
            const ap = areaProgress[area.slug];
            const meta = ap ? areaLevelProgress(ap.xp) : null;
            return (
              <BentoArea
                key={area.slug}
                area={area}
                level={meta?.level}
                xpPct={meta?.pct}
              />
            );
          })}
        </div>

      </section>

      <CheckinSheet
        open={sheetOpen}
        quest={quest}
        submitting={submitting}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleSubmitCheckin}
      />

      {xpToast && (
        <XPToast
          amount={xpToast.amount}
          leveledUp={xpToast.leveledUp}
          onDone={() => setXpToast(null)}
        />
      )}
    </MobileShell>
  );
}
