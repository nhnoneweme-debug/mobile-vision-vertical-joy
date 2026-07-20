import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sun, Coffee, ArrowRight } from "lucide-react";
import { recordSnooze, markAwake } from "@/lib/wake.functions";
import { z } from "zod";

const searchSchema = z.object({
  session: z.string().optional().default(""),
  label: z.string().optional().default("Despertar"),
});

export const Route = createFileRoute("/_authenticated/despertar/ringing")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Acordar — WiMi" }] }),
  component: RingingPage,
});

function useBeepLoop(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!active) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    ctxRef.current = ctx;
    const beep = () => {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.setValueAtTime(880, t + 0.35);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1);
    };
    // Kick off; some browsers need a user gesture — we still try.
    ctx.resume().catch(() => {});
    beep();
    timerRef.current = setInterval(beep, 1400);
    if ("vibrate" in navigator) {
      const vib = setInterval(() => navigator.vibrate?.([600, 300, 600, 300, 800]), 2500);
      return () => {
        clearInterval(vib);
        if (timerRef.current) clearInterval(timerRef.current);
        ctx.close().catch(() => {});
      };
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      ctx.close().catch(() => {});
    };
  }, [active]);
}

function RingingPage() {
  const { session, label } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());
  const active = snoozeUntil === null;

  useBeepLoop(active);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (snoozeUntil == null) return;
    const check = setInterval(() => {
      if (Date.now() >= snoozeUntil) {
        setSnoozeUntil(null);
      }
    }, 1000);
    return () => clearInterval(check);
  }, [snoozeUntil]);

  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  async function snooze(min: number) {
    if (!session) {
      setSnoozeUntil(Date.now() + min * 60_000);
      return;
    }
    setBusy(true);
    try {
      await recordSnooze({ data: { session_id: session, minutes: min } });
      setSnoozeUntil(Date.now() + min * 60_000);
    } catch {
      setSnoozeUntil(Date.now() + min * 60_000);
    } finally {
      setBusy(false);
    }
  }

  async function acordar() {
    setBusy(true);
    try {
      if (session) await markAwake({ data: { session_id: session } });
    } catch {
      /* segue */
    } finally {
      void navigate({ to: "/despertar/sonho", search: { session } as never });
    }
  }

  if (snoozeUntil != null) {
    const restMs = Math.max(0, snoozeUntil - Date.now());
    const restMin = Math.floor(restMs / 60_000);
    const restSec = Math.floor((restMs % 60_000) / 1000);
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-6 bg-charcoal-900 text-foreground">
        <Coffee className="h-16 w-16 text-ember/70" strokeWidth={1.5} />
        <p className="font-display text-2xl tracking-wide text-center">Descanse mais um pouco…</p>
        <p className="text-4xl font-mono">
          {String(restMin).padStart(2, "0")}:{String(restSec).padStart(2, "0")}
        </p>
        <button
          onClick={() => setSnoozeUntil(null)}
          className="mt-4 rounded-xl border border-border px-4 py-2 text-sm"
        >
          Voltar a tocar agora
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-between p-6 gap-6 bg-gradient-to-b from-ember/20 to-charcoal-900 text-foreground">
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
        <Sun className="h-20 w-20 text-ember animate-pulse" strokeWidth={1.5} />
        <p className="text-6xl font-display tracking-wider">{hhmm}</p>
        <p className="font-display text-xl tracking-wide text-foreground/80">{label}</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Bom dia. A WiMi está aqui. Posso voltar em alguns minutos ou já começar o seu dia.
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          {[5, 10, 15].map((m) => (
            <button
              key={m}
              disabled={busy}
              onClick={() => snooze(m)}
              className="rounded-xl border border-border bg-charcoal-800 py-3 text-sm active:scale-95 disabled:opacity-50"
            >
              +{m} min
            </button>
          ))}
        </div>
        <button
          disabled={busy}
          onClick={acordar}
          className="flex items-center justify-center gap-2 rounded-xl bg-ember py-4 font-display text-lg tracking-wide text-primary-foreground ember-glow active:scale-95 disabled:opacity-50"
        >
          Acordei <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
