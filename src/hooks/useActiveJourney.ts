// Hook: calcula, em tempo real, qual bloco está EM EXECUÇÃO agora e qual é
// o PRÓXIMO. Base: user_missions do usuário logado, apenas as agendadas para
// hoje e com `scheduled_time` definido. A precisão bate os minutos — o tick
// dispara a cada 30s pra manter o "AGORA / A SEGUIR" honesto sem custo.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isScheduledToday, listMissions, type UserMissionWithMeta } from "@/lib/missions";

const DEFAULT_DURATION_MIN = 30;

export type JourneyBlock = {
  id: string;
  title: string;
  area: string | null;
  startMin: number; // minutos desde 00:00
  endMin: number;
  raw: UserMissionWithMeta;
};

export type ActiveJourney = {
  current: JourneyBlock | null;
  next: JourneyBlock | null;
  // Todos os blocos agendados para hoje, em ordem.
  blocks: JourneyBlock[];
  // 0..100 do bloco atual
  progressPct: number;
  minutesToEndOfCurrent: number | null;
  minutesToStartOfNext: number | null;
  nowMin: number;
  loading: boolean;
  refresh: () => void;
};


function parseHM(s: string | null | undefined): number | null {
  if (!s) return null;
  const [h, m] = s.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function useActiveJourney(): ActiveJourney {
  const [missions, setMissions] = useState<UserMissionWithMeta[]>([]);
  const [tick, setTick] = useState<number>(() => nowMinutes());
  const [loading, setLoading] = useState<boolean>(true);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // Carga: pega missões ativas do usuário logado.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id;
        if (!uid) {
          if (alive) {
            setMissions([]);
            setLoading(false);
          }
          return;
        }
        const list = await listMissions(uid);
        if (alive) setMissions(list.filter(isScheduledToday));
      } catch {
        if (alive) setMissions([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // Tick — 30s é o suficiente pra manter progresso e gatilhos precisos.
  useEffect(() => {
    const id = window.setInterval(() => setTick(nowMinutes()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const blocks: JourneyBlock[] = missions
    .map((m) => {
      const start = parseHM(m.scheduled_time);
      if (start == null) return null;
      const end = parseHM(m.end_time) ?? start + DEFAULT_DURATION_MIN;
      return {
        id: m.id,
        title: m.title,
        area: m.area_slug,
        startMin: start,
        endMin: Math.max(end, start + 1),
        raw: m,
      } as JourneyBlock;
    })
    .filter((b): b is JourneyBlock => b !== null)
    .sort((a, b) => a.startMin - b.startMin);

  const nowMin = tick;
  const current = blocks.find((b) => nowMin >= b.startMin && nowMin < b.endMin) ?? null;
  const next =
    blocks.find((b) => b.startMin > nowMin) ??
    // Se não há próximo agendado depois de agora, e há um "current",
    // o próximo é o primeiro do dia seguinte (não sabemos), então null.
    null;

  const minutesToEndOfCurrent = current ? Math.max(0, current.endMin - nowMin) : null;
  const minutesToStartOfNext = next ? Math.max(0, next.startMin - nowMin) : null;
  const progressPct = current
    ? Math.max(
        0,
        Math.min(100, Math.round(((nowMin - current.startMin) / (current.endMin - current.startMin)) * 100)),
      )
    : 0;

  return {
    current,
    next,
    progressPct,
    minutesToEndOfCurrent,
    minutesToStartOfNext,
    nowMin,
    loading,
    refresh,
  };
}
