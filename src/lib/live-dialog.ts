// LIVE DINÂMICO — endereçamento ("é pra Wimi?") e códigos de comunicação.
//
// Três canais, nesta ordem de prioridade:
//   a. CÓDIGO DE CHAMADA (ex.: "wimi") em qualquer ponto da fala;
//   b. CÓDIGO DE LIBERAÇÃO ("modo livre") / RETORNO ("só quando eu chamar");
//   c. heurística de ambiente (decidida no servidor, com viés de silêncio).
//
// Os códigos são editáveis pelo usuário e persistidos localmente por ambiente.

const CODES_KEY = "wimi.live.callcodes.v1";
const MODE_KEY = "wimi.live.address.v1";

export type AddressMode = "addressed" | "free";

/** Códigos de chamada padrão + variações fonéticas razoáveis do nome. */
export const DEFAULT_CALL_CODES = ["wimi", "wimí", "uimi", "wimmy", "weme", "wi mi"];

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function loadCallCodes(): string[] {
  try {
    const raw = localStorage.getItem(CODES_KEY);
    if (!raw) return [...DEFAULT_CALL_CODES];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((c) => typeof c === "string") && parsed.length)
      return parsed as string[];
  } catch {
    /* storage opcional */
  }
  return [...DEFAULT_CALL_CODES];
}

export function saveCallCodes(codes: string[]) {
  const clean = codes.map((c) => c.trim()).filter(Boolean);
  try {
    localStorage.setItem(CODES_KEY, JSON.stringify(clean.length ? clean : DEFAULT_CALL_CODES));
  } catch {
    /* storage opcional */
  }
}

export function loadAddressMode(): AddressMode {
  try {
    return localStorage.getItem(MODE_KEY) === "free" ? "free" : "addressed";
  } catch {
    return "addressed";
  }
}

export function saveAddressMode(mode: AddressMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* storage opcional */
  }
}

/** (a) A fala contém algum código de chamada? */
export function hasCallCode(text: string, codes: string[]): string | null {
  const hay = ` ${normalize(text)} `;
  for (const code of codes) {
    const needle = ` ${normalize(code)} `;
    if (needle.trim() && hay.includes(needle)) return code;
  }
  return null;
}

const FREE_PHRASES = ["modo livre", "responde a tudo", "pode responder sempre"];
const ADDRESSED_PHRASES = [
  "so quando eu chamar",
  "somente quando eu chamar",
  "so quando chamar",
  "modo endereçado",
  "modo enderecado",
];
const SESSION_TALK_PHRASES = [
  "vamos falar disso",
  "conversar sobre a sessao",
  "falar sobre a sessao",
  "vamos falar da sessao",
];

/** (b) Código de liberação / retorno ao modo endereçado. */
export function detectModeCommand(text: string): AddressMode | null {
  const hay = normalize(text);
  if (ADDRESSED_PHRASES.some((p) => hay.includes(normalize(p)))) return "addressed";
  if (FREE_PHRASES.some((p) => hay.includes(normalize(p)))) return "free";
  return null;
}

/** Código de voz que abre a conversa sobre o conteúdo coletado. */
export function detectSessionTalk(text: string): boolean {
  const hay = normalize(text);
  return SESSION_TALK_PHRASES.some((p) => hay.includes(normalize(p)));
}

/** Remove o código de chamada do início da frase, para a pergunta ficar limpa. */
export function stripCallCode(text: string, codes: string[]): string {
  let out = text.trim();
  for (const code of codes) {
    const re = new RegExp(`^\\s*${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[,!?\\s]+`, "i");
    out = out.replace(re, "");
  }
  return out.trim();
}
