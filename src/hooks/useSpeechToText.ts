import { useCallback, useEffect, useRef, useState } from "react";

// Reconhecimento de fala (Web Speech API) em pt-BR.
//
// A versão anterior usava `continuous=true` + auto-restart. No Chrome mobile isso
// costuma tocar um beep a cada start/restart e pode reemitir o mesmo resultado
// final, gerando "oi, oi" no campo. Aqui mantemos uma sessão única iniciada por
// gesto do usuário, sem religar automaticamente. O usuário toca no mic para
// pausar/parar e toca de novo para continuar.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recognition = any;

type UseSpeechToTextOptions = {
  /**
   * Quando false, a captura para na primeira frase. Por padrão fica ligado
   * para manter a conversa fluida sem precisar reiniciar a cada palavra.
   */
  continuous?: boolean;
  /** BCP-47 do reconhecimento (pt-BR, en-US, es-ES). Troca a quente. */
  lang?: string;
};

type RecentCommit = { norm: string; at: number };

const RECENT_COMMIT_TTL = 20_000;
const TAIL_WORDS_TO_COMPARE = 18;

function normalizeSpeechText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTranscript(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function wordsOf(text: string) {
  return cleanTranscript(text).split(/\s+/).filter(Boolean);
}

function lastWords(text: string, count: number) {
  const words = wordsOf(text);
  return words.slice(Math.max(0, words.length - count)).join(" ");
}

function collapseImmediateEcho(text: string) {
  const words = wordsOf(text);
  if (words.length < 2) return cleanTranscript(text);

  // "oi oi oi" / "teste teste" / pequenas frases espelhadas na mesma emissão.
  for (let size = 1; size <= Math.floor(words.length / 2); size++) {
    if (words.length % size !== 0) continue;
    const first = normalizeSpeechText(words.slice(0, size).join(" "));
    if (!first || first.length > 80) continue;
    let repeated = true;
    for (let i = size; i < words.length; i += size) {
      if (normalizeSpeechText(words.slice(i, i + size).join(" ")) !== first) {
        repeated = false;
        break;
      }
    }
    if (repeated) return words.slice(0, size).join(" ");
  }

  return cleanTranscript(text);
}

function subtractAlreadyCommitted(candidate: string, committedTail: string) {
  const candidateWords = wordsOf(candidate);
  const tailWords = wordsOf(committedTail);
  if (!candidateWords.length || !tailWords.length) return cleanTranscript(candidate);

  const normalizedCandidate = candidateWords.map(normalizeSpeechText);
  const normalizedTail = tailWords.map(normalizeSpeechText);
  const maxOverlap = Math.min(normalizedCandidate.length, normalizedTail.length);

  for (let size = maxOverlap; size >= 1; size--) {
    const tailSlice = normalizedTail.slice(normalizedTail.length - size).join(" ");
    const candidateSlice = normalizedCandidate.slice(0, size).join(" ");
    if (tailSlice === candidateSlice) {
      return candidateWords.slice(size).join(" ");
    }
  }

  return cleanTranscript(candidate);
}

function getSpeechRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechToText(
  onFinalText: (text: string) => void,
  options: UseSpeechToTextOptions = {},
) {
  const continuous = options.continuous !== false;
  const lang = options.lang || "pt-BR";
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [muted, setMuted] = useState(false);
  const [interim, setInterim] = useState("");
  const [preview, setPreview] = useState("");

  const recRef = useRef<Recognition>(null);
  const activeRef = useRef(false);
  const mutedRef = useRef(false);
  const sessionRef = useRef(0);
  const committedTextRef = useRef("");
  const recentCommitsRef = useRef<RecentCommit[]>([]);
  const finalResultKeysRef = useRef<Set<string>>(new Set());
  const onFinalRef = useRef(onFinalText);
  onFinalRef.current = onFinalText;
  const langRef = useRef(lang);

  const appendPreview = useCallback((text: string) => {
    const t = cleanTranscript(text);
    if (!t) return;
    setPreview((prev) => {
      const next = `${prev} ${t}`.trim().replace(/\s+/g, " ");
      return next.length > 900 ? next.slice(-900).replace(/^\S+\s*/, "") : next;
    });
  }, []);

  const commitFinalText = useCallback(
    (raw: string) => {
      let text = collapseImmediateEcho(raw);
      text = subtractAlreadyCommitted(
        text,
        lastWords(committedTextRef.current, TAIL_WORDS_TO_COMPARE),
      );
      text = collapseImmediateEcho(text);
      if (!text) return;

      const norm = normalizeSpeechText(text);
      if (!norm) return;

      const now = Date.now();
      recentCommitsRef.current = recentCommitsRef.current.filter(
        (item) => now - item.at < RECENT_COMMIT_TTL,
      );
      if (recentCommitsRef.current.some((item) => item.norm === norm)) return;

      recentCommitsRef.current.push({ norm, at: now });
      committedTextRef.current = `${committedTextRef.current} ${text}`.trim();
      appendPreview(text);
      onFinalRef.current(text);
    },
    [appendPreview],
  );

  const stopRecognition = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    rec.onstart = null;
    rec.onend = null;
    rec.onerror = null;
    rec.onresult = null;
    try {
      rec.abort();
    } catch {
      /* já parado */
    }
    recRef.current = null;
  }, []);

  const createAndStart = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR || recRef.current || !activeRef.current || mutedRef.current) return false;

    const session = sessionRef.current;
    finalResultKeysRef.current = new Set();

    const rec = new SR();
    rec.lang = langRef.current;
    rec.continuous = continuous;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      if (session !== sessionRef.current) return;
      setListening(true);
    };

    rec.onend = () => {
      if (session !== sessionRef.current) return;
      recRef.current = null;
      setInterim("");
      // Modo manual: o mic só fecha quando o usuário toca no botão.
      // Se ainda estamos ativos (e não mutados), religamos silenciosamente
      // para manter a sessão aberta mesmo quando o Chrome encerra sozinho
      // após uma frase ou por timeout interno.
      if (activeRef.current && !mutedRef.current) {
        setTimeout(() => {
          if (session === sessionRef.current && activeRef.current && !mutedRef.current) {
            createAndStart();
          }
        }, 150);
      } else {
        setListening(false);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (ev: any) => {
      if (session !== sessionRef.current) return;
      const code = ev?.error;
      if (code === "no-speech" || code === "aborted") return;
      activeRef.current = false;
      mutedRef.current = false;
      recRef.current = null;
      setMuted(false);
      setListening(false);
      setInterim("");
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (ev: any) => {
      if (session !== sessionRef.current) return;
      let nextInterim = "";

      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const transcript = cleanTranscript(r?.[0]?.transcript ?? "");
        if (!transcript) continue;

        if (r.isFinal) {
          const key = `${i}:${normalizeSpeechText(transcript)}`;
          if (finalResultKeysRef.current.has(key)) continue;
          finalResultKeysRef.current.add(key);
          commitFinalText(transcript);
        } else {
          nextInterim = `${nextInterim} ${transcript}`.trim();
        }
      }

      setInterim(nextInterim ? collapseImmediateEcho(nextInterim) : "");
    };

    try {
      recRef.current = rec;
      rec.start();
      return true;
    } catch {
      if (recRef.current === rec) recRef.current = null;
      setListening(false);
      return false;
    }
  }, [commitFinalText, continuous]);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    activeRef.current = false;
    mutedRef.current = false;
    setMuted(false);
    setListening(false);
    setInterim("");
    setPreview("");
    stopRecognition();
  }, [stopRecognition]);

  const start = useCallback(() => {
    if (activeRef.current) return createAndStart();
    sessionRef.current += 1;
    activeRef.current = true;
    mutedRef.current = false;
    committedTextRef.current = "";
    recentCommitsRef.current = [];
    setMuted(false);
    setInterim("");
    setPreview("");
    return createAndStart();
  }, [createAndStart]);

  const mute = useCallback(() => {
    if (!activeRef.current) return;
    sessionRef.current += 1;
    mutedRef.current = true;
    setMuted(true);
    setListening(false);
    setInterim("");
    stopRecognition();
  }, [stopRecognition]);

  const unmute = useCallback(() => {
    if (!activeRef.current) return;
    sessionRef.current += 1;
    mutedRef.current = false;
    setMuted(false);
    createAndStart();
  }, [createAndStart]);

  const toggle = useCallback(() => {
    if (!activeRef.current) {
      start();
      return;
    }
    if (recRef.current || listening) {
      stop();
      return;
    }
    createAndStart();
  }, [createAndStart, listening, start, stop]);

  const toggleMute = useCallback(() => {
    if (mutedRef.current) unmute();
    else mute();
  }, [mute, unmute]);

  useEffect(() => {
    setSupported(!!getSpeechRecognition());
  }, []);

  // Troca de idioma a quente: reinicia só o reconhecedor, mantendo a sessão
  // (buffer/committed) intacta — o usuário continua falando sem interrupção.
  useEffect(() => {
    if (langRef.current === lang) return;
    langRef.current = lang;
    if (!activeRef.current || mutedRef.current) return;
    sessionRef.current += 1;
    stopRecognition();
    const t = window.setTimeout(() => createAndStart(), 120);
    return () => window.clearTimeout(t);
  }, [createAndStart, lang, stopRecognition]);

  useEffect(() => stop, [stop]);

  return {
    listening,
    supported,
    muted,
    interim,
    preview: `${preview} ${interim}`.trim(),
    start,
    stop,
    toggle,
    mute,
    unmute,
    toggleMute,
  };
}
