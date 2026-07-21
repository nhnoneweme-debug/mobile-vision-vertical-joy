// Acordos de acompanhamento da WiMi.
//
// A ideia: os gatilhos de manifestação (avisar que o bloco atual está acabando,
// avisar quando começa o próximo etc.) não são fixos — o usuário e a IA
// combinam os tempos e o sistema lembra. Por enquanto os "acordos" vivem no
// localStorage (decisão por dispositivo, sem migration). Quando fizermos a
// coluna em `chat_settings`, esta camada continua a mesma; só troca a fonte.

export type JourneyPhase = "preEnd" | "atEnd" | "preStart";

export type JourneyAgreements = {
  // Minutos antes do fim do bloco atual para o primeiro aviso.
  preEnd: number;
  // Segundos de tolerância no gatilho "no fim" (aceita 0 = pontual).
  atEnd: number;
  // Minutos antes do início do próximo bloco.
  preStart: number;
};

export const DEFAULT_AGREEMENTS: JourneyAgreements = {
  preEnd: 2,
  atEnd: 0,
  preStart: 1,
};

const KEY = "wimi:journey:agreements";
const CHOICE_KEY = "wimi:journey:choices";

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function loadAgreements(): JourneyAgreements {
  if (typeof window === "undefined") return DEFAULT_AGREEMENTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_AGREEMENTS;
    const parsed = JSON.parse(raw) as Partial<JourneyAgreements>;
    return {
      preEnd: clamp(parsed.preEnd ?? DEFAULT_AGREEMENTS.preEnd, 0, 30),
      atEnd: clamp(parsed.atEnd ?? DEFAULT_AGREEMENTS.atEnd, 0, 10),
      preStart: clamp(parsed.preStart ?? DEFAULT_AGREEMENTS.preStart, 0, 30),
    };
  } catch {
    return DEFAULT_AGREEMENTS;
  }
}

export function saveAgreements(a: JourneyAgreements): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        preEnd: clamp(a.preEnd, 0, 30),
        atEnd: clamp(a.atEnd, 0, 10),
        preStart: clamp(a.preStart, 0, 30),
      }),
    );
  } catch {
    /* noop */
  }
}

// Contador de escolhas por (kind|phase|actionId). Serve pra reordenar as 3
// sugestões dinâmicas: o que o usuário mais escolheu vai primeiro.
type ChoiceMap = Record<string, number>;

function loadChoices(): ChoiceMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CHOICE_KEY);
    return raw ? (JSON.parse(raw) as ChoiceMap) : {};
  } catch {
    return {};
  }
}

function saveChoices(map: ChoiceMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHOICE_KEY, JSON.stringify(map));
  } catch {
    /* noop */
  }
}

function choiceKey(kind: string, phase: JourneyPhase, actionId: string) {
  return `${kind}|${phase}|${actionId}`;
}

export function recordChoice(kind: string, phase: JourneyPhase, actionId: string): void {
  const map = loadChoices();
  const k = choiceKey(kind, phase, actionId);
  map[k] = (map[k] ?? 0) + 1;
  saveChoices(map);
}

export function choiceWeight(kind: string, phase: JourneyPhase, actionId: string): number {
  const map = loadChoices();
  return map[choiceKey(kind, phase, actionId)] ?? 0;
}

// Marcador para não repetir a mesma manifestação após reload.
export function markFired(missionId: string, dateISO: string, phase: JourneyPhase): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`wimi:journey:fired:${missionId}:${dateISO}:${phase}`, "1");
  } catch {
    /* noop */
  }
}

export function wasFired(missionId: string, dateISO: string, phase: JourneyPhase): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`wimi:journey:fired:${missionId}:${dateISO}:${phase}`) === "1";
  } catch {
    return false;
  }
}
