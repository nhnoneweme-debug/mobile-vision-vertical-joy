// IDENTIDADES WI E MI (Camada 3.7).
//
// "WiMi" é o par. Quem responde é sempre uma das duas identidades:
//   • Wi — TUTORA, voz feminina, tom acolhedor: acompanhamento do dia a dia,
//     dúvidas práticas, instrução, incentivo, log de jornada, rituais.
//   • Mi — MENTOR, voz masculina, tom direto: decisões, estratégia, revisão
//     crítica, confronto honesto com o registrado, avaliação de progresso.
//
// A invocação padrão continua sendo "WiMi": o modelo decide e devolve
// `persona`. Chamar "Wi" ou "Mi" diretamente FORÇA aquela identidade.

import type { TtsLangCode } from "@/lib/tts-voices";

export type Persona = "wi" | "mi";
/** Em gatilhos: "auto" deixa o modelo escolher. */
export type PersonaChoice = Persona | "auto";

export const PERSONA_LABEL: Record<Persona, string> = { wi: "Wi", mi: "Mi" };

export const PERSONA_ROLE: Record<Persona, string> = {
  wi: "tutora",
  mi: "mentor",
};

export const PERSONA_HINT: Record<Persona, string> = {
  wi: "acompanhamento, prática, instrução e incentivo",
  mi: "decisão, estratégia, revisão crítica e avaliação",
};

/** Fallback normativo: sem persona válida, quem fala é a Wi. */
export const DEFAULT_PERSONA: Persona = "wi";

export function normalizePersona(value: unknown): Persona {
  return value === "mi" ? "mi" : "wi";
}

export function resolvePersonaChoice(choice: PersonaChoice | undefined | null): Persona | null {
  return choice === "wi" || choice === "mi" ? choice : null;
}

// ------------------------------------------------------- invocação direta

function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detecta invocação DIRETA de uma identidade ("wi, me explica" / "mi, avalia").
 * "wimi" (o par) NÃO conta: nesse caso o roteamento é do modelo.
 */
export function detectDirectPersona(text: string): Persona | null {
  const hay = ` ${norm(text)} `;
  if (hay.includes(" wimi ") || hay.includes(" wi mi ")) return null;
  if (/\s(mi)\s/.test(hay)) return "mi";
  if (/\s(wi|ui)\s/.test(hay)) return "wi";
  return null;
}

// ------------------------------------------------------------------ vozes

const SERVER_VOICE_KEY = "wimi.persona.servervoice.v1";
const DEVICE_VOICE_KEY = "wimi.persona.devicevoice.v1";

/** Timbres padrão: Wi feminina, Mi masculino. */
export const PERSONA_DEFAULT_SERVER_VOICE: Record<Persona, string> = {
  wi: "nova",
  mi: "onyx",
};

function readMap(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeMap(key: string, map: Record<string, string>) {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* storage opcional */
  }
}

export function getPersonaServerVoice(persona: Persona): string {
  if (typeof localStorage === "undefined") return PERSONA_DEFAULT_SERVER_VOICE[persona];
  return readMap(SERVER_VOICE_KEY)[persona] ?? PERSONA_DEFAULT_SERVER_VOICE[persona];
}

export function setPersonaServerVoice(persona: Persona, voice: string): void {
  const map = readMap(SERVER_VOICE_KEY);
  map[persona] = voice;
  writeMap(SERVER_VOICE_KEY, map);
}

function deviceKey(persona: Persona, base: TtsLangCode) {
  return `${persona}:${base}`;
}

export function getPersonaDeviceVoice(persona: Persona, base: TtsLangCode): string | null {
  if (typeof localStorage === "undefined") return null;
  return readMap(DEVICE_VOICE_KEY)[deviceKey(persona, base)] ?? null;
}

export function setPersonaDeviceVoice(
  persona: Persona,
  base: TtsLangCode,
  voiceURI: string | null,
): void {
  const map = readMap(DEVICE_VOICE_KEY);
  const k = deviceKey(persona, base);
  if (voiceURI) map[k] = voiceURI;
  else delete map[k];
  writeMap(DEVICE_VOICE_KEY, map);
}
