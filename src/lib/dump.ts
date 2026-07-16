import type { NotificationPrefs, RitualType } from "@/lib/ritual";

// Quando o dump deve aparecer, a partir dos horários que a pessoa definiu:
// - de manhã (ao acordar): registrar os sonhos
// - à noite (antes de dormir): registrar o dia
//
// A janela abre no horário e dura algumas horas — quem acorda 7h e abre o app
// 8h30 ainda quer registrar o sonho. A janela da noite atravessa a meia-noite
// (dorme 23h, abre 00h20 → ainda é o dump da noite anterior).

export const MORNING_WINDOW_H = 3;
export const NIGHT_WINDOW_H = 4;
/** O dump da noite abre ANTES da hora de dormir — pegar a pessoa já na cama é tarde. */
export const NIGHT_LEAD_H = 0.5;

export type DumpWindow = {
  type: RitualType;
  /** Data (YYYY-MM-DD) a que o dump se refere — noite após meia-noite conta pro dia anterior. */
  refDate: string;
};

const isoDate = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

/** Horas decorridas desde `hour` até `now`, ciclando em 24h (sempre 0..24). */
function hoursSince(now: Date, hour: number): number {
  const cur = now.getHours() + now.getMinutes() / 60;
  return (cur - hour + 24) % 24;
}

/**
 * Qual dump está "na hora" agora, ou null fora das janelas.
 * Se as duas janelas se sobrepõem (horários muito próximos), vence a que abriu
 * mais recentemente.
 */
export function currentDumpWindow(
  prefs: Pick<NotificationPrefs, "morning_hour" | "night_hour">,
  now: Date = new Date(),
): DumpWindow | null {
  // A janela da noite abre 30 min antes da hora de dormir. O + 24 % 24 importa:
  // com night_hour = 0 (dorme à meia-noite) o início seria -0.5 → vira 23:30.
  const nightStart = (prefs.night_hour - NIGHT_LEAD_H + 24) % 24;

  const sinceMorning = hoursSince(now, prefs.morning_hour);
  const sinceNight = hoursSince(now, nightStart);
  const inMorning = sinceMorning < MORNING_WINDOW_H;
  const inNight = sinceNight < NIGHT_WINDOW_H;

  if (inMorning && (!inNight || sinceMorning <= sinceNight)) {
    return { type: "morning", refDate: isoDate(now) };
  }
  if (inNight) {
    // Passou da meia-noite: o dump ainda é sobre o dia que acabou.
    const crossedMidnight = now.getHours() + now.getMinutes() / 60 < nightStart;
    const ref = new Date(now);
    if (crossedMidnight) ref.setDate(ref.getDate() - 1);
    return { type: "night", refDate: isoDate(ref) };
  }
  return null;
}

export function dumpCopy(type: RitualType) {
  return type === "morning"
    ? {
        title: "Bom dia — o que você sonhou?",
        sub: "Fala enquanto lembra. Eu organizo o resto.",
        cta: "REGISTRAR SONHO",
        to: "/despertar" as const,
      }
    : {
        title: "Hora de fechar o dia",
        sub: "Dump cru do que rolou. Eu organizo.",
        cta: "REGISTRAR O DIA",
        to: "/dormir" as const,
      };
}

/** Chave do dispensar-por-hoje, pra não reabrir o banner o dia todo. */
export function dumpDismissKey(w: DumpWindow) {
  return `dump-dismissed:${w.type}:${w.refDate}`;
}
