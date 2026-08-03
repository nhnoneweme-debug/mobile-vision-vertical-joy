// Utilitário central de seleção de voz para as manifestações da WiMi.
//
// Causa do sotaque: definir apenas `utterance.lang = 'pt-BR'` NÃO troca a voz.
// O navegador continua usando a voz padrão do sistema (normalmente en-US), que
// lê português com fonética inglesa. É obrigatório atribuir `utterance.voice`
// a uma voz real da lista cujo `lang` comece com 'pt'.
//
// Além disso, no Chrome `speechSynthesis.getVoices()` volta VAZIO na primeira
// chamada — a lista só chega no evento 'voiceschanged'. Sem esperar por ele a
// seleção falha em silêncio e cai na voz padrão.

export type TtsLangCode = "pt" | "en" | "es";

const VOICE_PREF_KEY = "wimi.tts.voice.v1";

type StoredVoicePref = Record<string, { voiceURI: string; name: string }>;

let voicesCache: SpeechSynthesisVoice[] = [];
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;
const chosenCache = new Map<string, SpeechSynthesisVoice | null>();

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Base do idioma: 'pt-BR' -> 'pt' */
export function langBase(lang: string | undefined): TtsLangCode {
  const b = (lang || "pt").slice(0, 2).toLowerCase();
  return b === "en" || b === "es" ? b : "pt";
}

/** Idioma completo preferido por base. */
export function defaultLocale(base: TtsLangCode): string {
  return base === "en" ? "en-US" : base === "es" ? "es-ES" : "pt-BR";
}

/**
 * Espera a lista de vozes ficar disponível (bug clássico do Chrome).
 * Resolve com lista possivelmente vazia após timeout curto.
 */
export function ensureVoices(timeoutMs = 3000): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([]);
  const immediate = window.speechSynthesis.getVoices();
  if (immediate.length) {
    voicesCache = immediate;
    return Promise.resolve(immediate);
  }
  if (voicesPromise) return voicesPromise;
  voicesPromise = new Promise<SpeechSynthesisVoice[]>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.speechSynthesis.removeEventListener("voiceschanged", onChange);
      voicesCache = window.speechSynthesis.getVoices();
      voicesPromise = null;
      resolve(voicesCache);
    };
    const onChange = () => finish();
    window.speechSynthesis.addEventListener("voiceschanged", onChange);
    // alguns navegadores só populam após uma chamada extra
    window.speechSynthesis.getVoices();
    window.setTimeout(finish, timeoutMs);
  });
  return voicesPromise;
}

/** Vozes já conhecidas (sincrono; pode estar vazio antes do ensureVoices). */
export function cachedVoices(): SpeechSynthesisVoice[] {
  if (!voicesCache.length && ttsSupported()) voicesCache = window.speechSynthesis.getVoices();
  return voicesCache;
}

const GOOD_NAMES = [
  "google português do brasil",
  "google português",
  "luciana",
  "microsoft francisca",
  "microsoft maria",
  "google español",
  "google us english",
  "microsoft",
  "google",
];

function score(v: SpeechSynthesisVoice): number {
  const name = (v.name || "").toLowerCase();
  const lang = (v.lang || "").toLowerCase().replace("_", "-");
  let s = 0;
  if (lang === "pt-br" || lang === "es-es" || lang === "en-us") s += 40;
  if (lang.startsWith("pt") && lang !== "pt-br") s += 5; // pt-PT vale menos que pt-BR
  const idx = GOOD_NAMES.findIndex((n) => name.includes(n));
  if (idx >= 0) s += 30 - idx * 2;
  if (!v.localService) s += 8; // vozes remotas costumam ser melhores
  if (v.default) s += 2;
  return s;
}

function byScoreDesc(a: SpeechSynthesisVoice, b: SpeechSynthesisVoice): number {
  return score(b) - score(a);
}

/** Vozes do idioma pedido, ordenadas por qualidade provável. */
export function listVoices(base: TtsLangCode, all = cachedVoices()): SpeechSynthesisVoice[] {
  return all.filter((v) => v.lang?.toLowerCase().startsWith(base)).sort(byScoreDesc);
}

function readPrefs(): StoredVoicePref {
  try {
    const raw = localStorage.getItem(VOICE_PREF_KEY);
    return raw ? (JSON.parse(raw) as StoredVoicePref) : {};
  } catch {
    return {};
  }
}

export function getVoicePref(base: TtsLangCode): { voiceURI: string; name: string } | null {
  return readPrefs()[base] ?? null;
}

export function setVoicePref(base: TtsLangCode, voice: SpeechSynthesisVoice | null): void {
  try {
    const prefs = readPrefs();
    if (voice) prefs[base] = { voiceURI: voice.voiceURI, name: voice.name };
    else delete prefs[base];
    localStorage.setItem(VOICE_PREF_KEY, JSON.stringify(prefs));
  } catch {
    /* storage indisponível */
  }
  chosenCache.delete(base);
}

/** Voz escolhida para o idioma (preferência do usuário > melhor automática). */
export function pickVoice(base: TtsLangCode): SpeechSynthesisVoice | null {
  if (chosenCache.has(base)) return chosenCache.get(base) ?? null;
  const options = listVoices(base);
  if (!options.length) {
    // não cacheia ausência enquanto a lista global ainda estiver vazia
    if (cachedVoices().length) chosenCache.set(base, null);
    return null;
  }
  const pref = getVoicePref(base);
  const chosen =
    (pref && options.find((v) => v.voiceURI === pref.voiceURI || v.name === pref.name)) ||
    options[0];
  chosenCache.set(base, chosen ?? null);
  return chosen ?? null;
}

export function clearVoiceCache(): void {
  chosenCache.clear();
}

export type SpeakResult = "spoken" | "no-voice" | "unsupported" | "empty";

export type SpeakOptions = {
  /** idioma da manifestação (pt-BR, en-US, es-ES…) */
  lang?: string;
  /** força uma voz específica do aparelho (identidades Wi/Mi) */
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
};

/**
 * Fala com voz explicitamente selecionada para o idioma.
 * Retorna 'no-voice' quando o aparelho não tem voz do idioma — nesse caso NÃO
 * fala (voz inglesa lendo português é pior que silêncio).
 */
export async function speakWithVoice(text: string, opts: SpeakOptions = {}): Promise<SpeakResult> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 600);
  if (!clean) {
    opts.onEnd?.();
    return "empty";
  }
  if (!ttsSupported()) {
    opts.onEnd?.();
    return "unsupported";
  }
  const base = langBase(opts.lang);
  await ensureVoices();
  const forced = opts.voiceURI
    ? (listVoices(base).find((v) => v.voiceURI === opts.voiceURI) ?? null)
    : null;
  const voice = forced ?? pickVoice(base);
  if (!voice) {
    opts.onEnd?.();
    return "no-voice";
  }
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.voice = voice;
    u.lang = voice.lang || defaultLocale(base);
    u.rate = opts.rate ?? 0.97;
    u.pitch = opts.pitch ?? 1;
    u.onstart = () => opts.onStart?.();
    u.onend = () => opts.onEnd?.();
    u.onerror = () => opts.onEnd?.();
    synth.speak(u);
    return "spoken";
  } catch {
    opts.onEnd?.();
    return "unsupported";
  }
}

export const SAMPLE_PHRASES: Record<TtsLangCode, string> = {
  pt: "Oi, sou a WiMi. Vou te acompanhar durante a execução.",
  en: "Hi, I'm WiMi. I'll be with you during this session.",
  es: "Hola, soy WiMi. Te acompaño durante la ejecución.",
};

export const NO_VOICE_HINT: Record<TtsLangCode, string> = {
  pt: "Seu aparelho não tem voz em português instalada — as manifestações vão aparecer em texto. Android: Configurações → Idiomas → Saída de conversão de texto em voz.",
  en: "No English voice installed on this device — manifestations will appear as text.",
  es: "Este dispositivo no tiene voz en español instalada — las manifestaciones aparecerán en texto.",
};
