import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MobileShell } from "@/components/shell/MobileShell";
import { BottomNav } from "@/components/shell/BottomNav";
import { AreaPlaceholder } from "@/components/placeholders/AreaPlaceholder";
import { AreaHeader } from "@/components/area/AreaHeader";
import { AreaMissionRow } from "@/components/area/AreaMissionRow";
import { CasaIntentionCard } from "@/components/area/CasaIntentionCard";
import { MentalJournalCard } from "@/components/area/MentalJournalCard";
import { CozinhaDietCard } from "@/components/area/CozinhaDietCard";
import { TreinoPlanCard } from "@/components/area/TreinoPlanCard";
import { QuartoSleepCard } from "@/components/area/QuartoSleepCard";
import { QuartoRitualsCard } from "@/components/area/QuartoRitualsCard";
import { InclusaoCard } from "@/components/area/InclusaoCard";

import { XPToast } from "@/components/map/XPToast";
import { getArea } from "@/components/map/areas";
import { supabase } from "@/integrations/supabase/client";
import {
  listAreaMissions,
  logAreaMission,
  undoLastAreaMission,
  type AreaMissionWithMeta,
  type AreaProgress,
} from "@/lib/area-missions";

export const Route = createFileRoute("/_authenticated/area/$slug")({
  head: ({ params }) => {
    const area = getArea(params.slug);
    return {
      meta: [
        { title: `${area?.name ?? "Área"} — Personal IA` },
        { name: "description", content: area?.description ?? "Área do mundo Personal IA." },
      ],
    };
  },
  loader: ({ params }) => {
    if (params.slug === "progresso") {
      throw redirect({ to: "/progresso" });
    }
    if (params.slug === "social") {
      throw redirect({ to: "/social" });
    }
    if (params.slug === "missoes") {
      throw redirect({ to: "/missoes" });
    }
    const area = getArea(params.slug);
    if (!area) throw notFound();
    return { area };
  },
  component: AreaPage,
});

function AreaPage() {
  const { area } = Route.useLoaderData();
  const [userId, setUserId] = useState<string | null>(null);
  const [klass, setKlass] = useState<string | null>(null);
  const [missions, setMissions] = useState<AreaMissionWithMeta[]>([]);
  const [progress, setProgress] = useState<AreaProgress>({
    area_slug: area.slug,
    level: 1,
    xp: 0,
  });
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [xpToast, setXpToast] = useState<{ amount: number; leveledUp: boolean } | null>(null);

  const refresh = useCallback(
    async (uid: string, k: string | null) => {
      const res = await listAreaMissions(area.slug, uid, k);
      setMissions(res.missions);
      setProgress(res.progress);
    },
    [area.slug],
  );

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: prof } = await supabase
        .from("profiles")
        .select("behavioral_class")
        .eq("id", data.user.id)
        .maybeSingle();
      const k = (prof?.behavioral_class as string) ?? null;
      setKlass(k);
      try {
        await refresh(data.user.id, k);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao carregar missões");
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  async function handleLog(m: AreaMissionWithMeta) {
    if (!userId) return;
    setPending(m.id);
    const prevLevel = progress.level;
    try {
      await logAreaMission(userId, m);
      await refresh(userId, klass);
      setProgress((p) => {
        const leveled = p.level > prevLevel;
        setXpToast({ amount: m.xp_reward, leveledUp: leveled });
        return p;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setPending(null);
    }
  }

  async function handleUndo(m: AreaMissionWithMeta) {
    if (!userId || !m.last_log_id) return;
    setPending(m.id);
    try {
      await undoLastAreaMission(m.last_log_id);
      await refresh(userId, klass);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setPending(null);
    }
  }

  // Missions are seeded for every area in the catalog, but if a slug has none
  // we gracefully fall back to the original placeholder — unless the area has
  // a custom widget (casa/mental) that should still render.
  const hasCustomWidget =
    area.slug === "casa" ||
    area.slug === "mental" ||
    area.slug === "cozinha" ||
    area.slug === "treino" ||
    area.slug === "quarto" ||
    area.slug === "inclusao";
  if (!loading && missions.length === 0 && !hasCustomWidget) {
    return (
      <MobileShell>
        <AreaPlaceholder area={area} />
        <BottomNav />
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <AreaHeader area={area} xp={progress.xp} />

      <div className="space-y-3 px-4 py-5 pb-32">
        {userId && area.slug === "casa" && <CasaIntentionCard userId={userId} />}
        {userId && area.slug === "mental" && (
          <>
            <MentalJournalCard userId={userId} />
            <Link
              to="/mental"
              className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 py-2.5 font-display text-[10px] tracking-[0.25em] text-emerald-400"
            >
              ABRIR JARDIM MENTAL COMPLETO →
            </Link>
          </>
        )}
        {userId && area.slug === "cozinha" && <CozinhaDietCard />}
        {userId && area.slug === "treino" && <TreinoPlanCard />}
        {userId && area.slug === "quarto" && <QuartoSleepCard />}
        {userId && area.slug === "quarto" && <QuartoRitualsCard />}
        {userId && area.slug === "inclusao" && <InclusaoCard userId={userId} />}


        <p className="font-display text-[10px] tracking-[0.3em] text-muted-foreground">
          MISSÕES DA SEMANA
        </p>


        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (
          missions.map((m) => (
            <AreaMissionRow
              key={m.id}
              mission={m}
              pending={pending === m.id}
              onLog={() => handleLog(m)}
              onUndo={() => handleUndo(m)}
            />
          ))
        )}
      </div>

      {xpToast && (
        <XPToast
          amount={xpToast.amount}
          leveledUp={xpToast.leveledUp}
          onDone={() => setXpToast(null)}
        />
      )}

      <BottomNav />
    </MobileShell>
  );
}
