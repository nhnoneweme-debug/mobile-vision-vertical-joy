import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { listAlarms, startWakeSession } from "@/lib/wake.functions";

const FIRED_KEY = (id: string, day: string) => `wimi:alarm-fired:${id}:${day}`;
const POLL_MS = 30_000;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hhmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Poll wake_alarms and, when the local device clock matches an enabled alarm
 * for today's weekday, start a wake_session and navigate to /despertar/ringing.
 * Foreground-only — service workers can't run reliable alarms on iOS PWA.
 */
export function useWakeAlarmScheduler(enabled: boolean) {
  const navigate = useNavigate();
  const location = useLocation();
  const ringingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function tick() {
      if (!alive || ringingRef.current) return;
      // Skip if already inside ringing screen
      if (location.pathname.startsWith("/despertar/ringing")) return;
      let alarms: Awaited<ReturnType<typeof listAlarms>>;
      try {
        alarms = await listAlarms();
      } catch {
        return;
      }
      if (!alive || !alarms) return;
      const now = new Date();
      const dow = now.getDay();
      const day = todayIso();
      const cur = hhmm();
      for (const a of alarms) {
        if (!a.enabled) continue;
        const days = (a.days_of_week as number[] | null) ?? [];
        if (days.length && !days.includes(dow)) continue;
        const t = (a.time_local as string).slice(0, 5);
        if (t !== cur) continue;
        const fkey = FIRED_KEY(a.id as string, day);
        if (localStorage.getItem(fkey)) continue;
        localStorage.setItem(fkey, "1");
        ringingRef.current = true;
        try {
          const session = await startWakeSession({ data: { alarm_id: a.id as string } });
          void navigate({
            to: "/despertar/ringing",
            search: { session: (session?.id as string) ?? "", label: a.label as string },
          } as never);
        } catch {
          ringingRef.current = false;
        }
        return;
      }
    }

    void tick();
    timer = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [enabled, navigate, location.pathname]);
}
