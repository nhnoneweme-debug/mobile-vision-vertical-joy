// Camada de fala unificada da WiMi (Camada 3.6).
//
// Ponto de entrada ÚNICO para todas as manifestações faladas. Cadeia de três
// degraus, nesta ordem:
//   a. TTS do servidor (/api/tts, conector de IA do Lovable) — melhor qualidade,
//      sem depender das vozes do aparelho (que leem português com sotaque inglês)
//   b. Voz nativa do aparelho (speechSynthesis) — se o servidor falhar, ficar sem
//      saldo (402), sem cota (429), offline ou demorar > 6s
//   c. Texto — a manifestação SEMPRE aparece escrita; voz é camada adicional
//
// Cache: áudio do servidor é guardado em IndexedDB por hash de (texto+voz+idioma),
// então frases repetidas (sinais de turno, perguntas padrão, confirmações) nunca
// custam duas vezes.

import { supabase } from "@/integrations/supabase/client";
import { speakWithVoice, langBase, defaultLocale, type TtsLangCode } from "@/lib/tts-voices";

export type TtsEngine = "server" | "device" | "text";

export const SERVER_VOICES: { id: string; label: string }[] = [
  { id: "nova", label: "Nova (feminina, calorosa)" },
  { id: "shimmer", label: "Shimmer (feminina, suave)" },
  { id: "alloy", label: "Alloy (neutra)" },
  { id: "echo", label: "Echo (masculina, serena)" },
  { id: "onyx", label: "Onyx (masculina, grave)" },
  { id: "fable", label: "Fable (expressiva)" },
];

const ENGINE_KEY = "wimi.tts.engine.v1";
const SERVER_VOICE_KEY = "wimi.tts.servervoice.v1";
/** Manifestações longas não viram áudio de servidor sem necessidade. */
export const MAX_SPOKEN_CHARS = 600;
const SERVER_TIMEOUT_MS = 6000;

export function getEngine(): TtsEngine {
  if (typeof localStorage === "undefined") return "server";
  const raw = localStorage.getItem(ENGINE_KEY);
  return raw === "device" || raw === "text" || raw === "server" ? raw : "server";
}

export function setEngine(engine: TtsEngine): void {
  try {
    localStorage.setItem(ENGINE_KEY, engine);
  } catch {
    /* storage indisponível */
  }
}

export function getServerVoice(): string {
  if (typeof localStorage === "undefined") return "nova";
  const raw = localStorage.getItem(SERVER_VOICE_KEY);
  return SERVER_VOICES.some((v) => v.id === raw) ? raw! : "nova";
}

export function setServerVoice(voice: string): void {
  try {
    localStorage.setItem(SERVER_VOICE_KEY, voice);
  } catch {
    /* storage indisponível */
  }
}

/** Encurta manifestações longas para não gastar áudio à toa. */
export function trimForSpeech(text: string, max = MAX_SPOKEN_CHARS): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut.trimEnd() + "…").trim();
}

// ————— cache em IndexedDB —————

const DB_NAME = "wimi-tts";
const STORE = "clips";
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function cacheKey(text: string, voice: string, lang: string): Promise<string> {
  const payload = `${lang}|${voice}|${text}`;
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // fallback simples (hash 32 bits) quando WebCrypto não está disponível
    let h = 0;
    for (let i = 0; i < payload.length; i++) h = (h * 31 + payload.charCodeAt(i)) | 0;
    return `f${(h >>> 0).toString(16)}-${payload.length}`;
  }
}

async function cacheGet(key: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function cachePut(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).put(blob, key);
  } catch {
    /* cache é oportunista */
  }
}

/** true quando a frase já está no cache local (usado no roteiro de teste/UI). */
export async function isCached(text: string, lang: string, voice = getServerVoice()) {
  const key = await cacheKey(trimForSpeech(text), voice, langBase(lang));
  return (await cacheGet(key)) != null;
}

// ————— reprodução —————

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let generation = 0;

export function stopSpeaking(): void {
  generation += 1;
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = "";
    } catch {
      /* noop */
    }
    currentAudio = null;
  }
  if (currentUrl) {
    try {
      URL.revokeObjectURL(currentUrl);
    } catch {
      /* noop */
    }
    currentUrl = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
  }
}

async function fetchServerAudio(
  text: string,
  lang: string,
  voice: string,
): Promise<{ blob: Blob | null; code?: number }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);
  try {
    let token: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token ?? null;
    } catch {
      /* sem sessão → 401 abaixo */
    }
    const res = await fetch("/api/tts", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text, lang, voice }),
    });
    if (!res.ok) return { blob: null, code: res.status };
    const blob = await res.blob();
    if (!blob.size) return { blob: null, code: 502 };
    return { blob };
  } catch {
    return { blob: null, code: 0 };
  } finally {
    window.clearTimeout(timer);
  }
}

function playBlob(blob: Blob, gen: number, opts: SpeakOptions): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    currentUrl = url;
    const audio = new Audio(url);
    audio.preload = "auto";
    currentAudio = audio;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (gen === generation) opts.onEnd?.();
      resolve();
    };
    audio.onplay = () => opts.onStart?.();
    audio.onended = finish;
    audio.onerror = finish;
    void audio.play().catch(finish);
  });
}

export type SpeakOptions = {
  /** idioma da manifestação (pt-BR, en-US, es-ES…) */
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  /** força um motor específico (usado pelas amostras do seletor) */
  engine?: TtsEngine;
  /** ignora o cache local (amostras de voz) */
  noCache?: boolean;
  /** timbre do servidor (identidades Wi/Mi) */
  voice?: string;
  /** voz do aparelho forçada (identidades Wi/Mi) */
  deviceVoiceURI?: string;
};

export type SpeakOutcome =
  | "server"
  | "server-cache"
  | "device"
  | "text-only"
  | "no-voice"
  | "empty";

/** Avisa a UI quando a fala caiu do servidor para a voz do aparelho. */
export type DegradeReason = "offline" | "no-credits" | "rate-limited" | "error";
type DegradeListener = (reason: DegradeReason | null) => void;
const degradeListeners = new Set<DegradeListener>();

export function onTtsDegrade(fn: DegradeListener): () => void {
  degradeListeners.add(fn);
  return () => degradeListeners.delete(fn);
}

function emitDegrade(reason: DegradeReason | null) {
  degradeListeners.forEach((fn) => fn(reason));
}

function reasonFromCode(code?: number): DegradeReason {
  if (code === 402) return "no-credits";
  if (code === 429) return "rate-limited";
  if (!code) return "offline";
  return "error";
}

/**
 * Fala uma manifestação. Único ponto de entrada — gatilhos, Log de Jornada,
 * Interação Livre, Live dinâmico e rituais passam por aqui.
 */
export async function speakUnified(text: string, opts: SpeakOptions = {}): Promise<SpeakOutcome> {
  const clean = trimForSpeech(text);
  if (!clean) {
    opts.onEnd?.();
    return "empty";
  }
  stopSpeaking();
  const gen = ++generation;

  const engine = opts.engine ?? getEngine();
  const lang = opts.lang ?? "pt-BR";
  const base: TtsLangCode = langBase(lang);

  if (engine === "text") {
    opts.onEnd?.();
    return "text-only";
  }

  if (engine === "server") {
    const voice = opts.voice ?? getServerVoice();
    const key = await cacheKey(clean, voice, base);
    if (gen !== generation) return "empty";

    if (!opts.noCache) {
      const cached = await cacheGet(key);
      if (gen !== generation) return "empty";
      if (cached) {
        emitDegrade(null);
        await playBlob(cached, gen, opts);
        return "server-cache";
      }
    }

    const { blob, code } = await fetchServerAudio(clean, defaultLocale(base), voice);
    if (gen !== generation) return "empty";
    if (blob) {
      emitDegrade(null);
      if (!opts.noCache) void cachePut(key, blob);
      await playBlob(blob, gen, opts);
      return "server";
    }
    // degrau (b): queda suave e silenciosa para a voz do aparelho
    emitDegrade(reasonFromCode(code));
  }

  const result = await speakWithVoice(clean, {
    lang: defaultLocale(base),
    voiceURI: opts.deviceVoiceURI,
    onStart: opts.onStart,
    onEnd: opts.onEnd,
  });
  if (result === "spoken") return "device";
  return result === "no-voice" || result === "unsupported" ? "no-voice" : "text-only";
}

export const DEGRADE_HINT: Record<DegradeReason, string> = {
  offline: "usando a voz do aparelho no momento (servidor de voz indisponível)",
  "no-credits": "usando a voz do aparelho no momento (sem saldo de IA)",
  "rate-limited": "usando a voz do aparelho no momento (limite de uso atingido)",
  error: "usando a voz do aparelho no momento",
};
