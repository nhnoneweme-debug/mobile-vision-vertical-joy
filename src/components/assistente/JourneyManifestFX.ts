// Efeitos sensoriais da manifestação da WiMi:
// - vibração via Navigator.vibrate (no-op onde não suportado);
// - "ping" curto via WebAudio (2 senoides) para chamar atenção quando o TTS
//   está desligado ou o navegador bloqueia o autoplay.
// Puro cliente, sem dependências de UI.

import type { JourneyPhase } from "@/lib/journey-agreements";

const VIBRATION: Record<JourneyPhase, number[]> = {
  preEnd: [120],
  atEnd: [200, 80, 200],
  preStart: [80, 60, 80],
};

export function vibrateFor(phase: JourneyPhase): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  if (typeof nav.vibrate !== "function") return;
  try {
    nav.vibrate(VIBRATION[phase] ?? [120]);
  } catch {
    /* noop */
  }
}

let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = (window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as
    | typeof AudioContext
    | undefined;
  if (!AC) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AC();
    } catch {
      audioCtx = null;
    }
  }
  return audioCtx;
}

/** Toca dois bipes curtos ascendentes. Ignora silenciosamente se falhar. */
export function playPing(phase: JourneyPhase = "atEnd"): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const base = phase === "preStart" ? 660 : phase === "preEnd" ? 520 : 780;
    const now = ctx.currentTime + 0.02;
    [0, 0.16].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = base + i * 120;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.22, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.16);
    });
  } catch {
    /* noop */
  }
}
