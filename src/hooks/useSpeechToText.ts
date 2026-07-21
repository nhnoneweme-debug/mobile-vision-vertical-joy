import { useCallback, useEffect, useRef, useState } from "react";

// Reconhecimento de fala (Web Speech API) em pt-BR, contínuo — a pessoa fala e
// o texto final vai caindo no callback. Usado pelo chat da IA e pelos dumps.
//
// `mute()` pausa a captura sem encerrar a "sessão" lógica: o usuário pode
// silenciar pra atender alguém e retomar sem perder o que já foi transcrito.
// `interim` expõe o texto parcial pra UI mostrar o acompanhamento ao vivo.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recognition = any;

type RecentFinal = { norm: string; at: number };

const RECENT_FINAL_TTL = 8_000;
const RESTART_DELAY_MS = 900;

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

function collapseLikelyEcho(text: string) {
  const clean = cleanTranscript(text);
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return clean;
  const normalized = words.map(normalizeSpeechText);
  const first = normalized[0];
  if (!first || first.length > 12) return clean;
  return normalized.every((w) => w === first) ? words[0] : clean;
}

function getSpeechRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechToText(onFinalText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [muted, setMuted] = useState(false);
  const [interim, setInterim] = useState("");
  const [preview, setPreview] = useState("");
  const recRef = useRef<Recognition>(null);
  const startingRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const sessionRef = useRef(0);
  const processedFinalIndexesRef = useRef<Set<number>>(new Set());
  const recentFinalsRef = useRef<RecentFinal[]>([]);
  const wantedRef = useRef(false);
  const mutedRef = useRef(false);
  const onFinalRef = useRef(onFinalText);
  onFinalRef.current = onFinalText;

  const appendPreview = useCallback((text: string) => {
    const t = cleanTranscript(text);
    if (!t) return;
    setPreview((prev) => {
      const next = `${prev} ${t}`.trim().replace(/\s+/g, " ");
      // Mantém só o trecho recente: a UI mostra as últimas 5 linhas e oculta o
      // que passou, sem acumular uma transcrição gigante na memória.
      return next.length > 900 ? next.slice(-900).replace(/^\S+\s*/, "") : next;
    });
  }, []);

  useEffect(() => {
    setSupported(!!getSpeechRecognition());
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current == null) return;
    window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  }, []);

  const shouldAcceptFinal = useCallback((text: string) => {
    const norm = normalizeSpeechText(text);
    if (!norm) return false;
    const now = Date.now();
    recentFinalsRef.current = recentFinalsRef.current.filter((item) => now - item.at < RECENT_FINAL_TTL);
    if (recentFinalsRef.current.some((item) => item.norm === norm)) return false;
    recentFinalsRef.current.push({ norm, at: now });
    return true;
  }, []);

  const stopRec = useCallback(() => {
    clearRestartTimer();
    const rec = recRef.current;
    if (rec) {
      try {
        rec.onstart = null;
        rec.onend = null;
        rec.onerror = null;
        rec.onresult = null;
        rec.abort();
      } catch {
        /* já parado */
      }
      recRef.current = null;
    }
    startingRef.current = false;
    processedFinalIndexesRef.current = new Set();
  }, [clearRestartTimer]);

  const startRec = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR || recRef.current || startingRef.current) return false;
    clearRestartTimer();
    startingRef.current = true;
    processedFinalIndexesRef.current = new Set();
    const session = sessionRef.current;
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => {
      if (session !== sessionRef.current) return;
      startingRef.current = false;
      setListening(true);
    };
    rec.onend = () => {
      if (session !== sessionRef.current) return;
      recRef.current = null;
      startingRef.current = false;
      // Religa se o usuário não mandou parar nem mutou. Mantemos `listening=true`
      // durante a religada para o preview de transcrição não piscar/desaparecer
      // no intervalo entre o `end` do Chrome (após silêncio) e o próximo `start`.
      if (wantedRef.current && !mutedRef.current) {
        // Atraso maior reduz religadas em rajada — principal causa dos bipes no
        // Chrome mobile — e um novo objeto evita resultados finais ecoados.
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null;
          if (session !== sessionRef.current || !wantedRef.current || mutedRef.current) return;
          startRec();
        }, RESTART_DELAY_MS);
        return;
      }
      setListening(false);
      setInterim("");
      setPreview("");
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (ev: any) => {
      // Em `no-speech`/`aborted` deixamos o onend religar; só derrubamos o
      // estado em erros duros (perm/network) — aí realmente paramos.
      const code = ev?.error;
      if (code && code !== "no-speech" && code !== "aborted") {
        wantedRef.current = false;
        sessionRef.current += 1;
        clearRestartTimer();
        if (recRef.current === rec) recRef.current = null;
        startingRef.current = false;
        try {
          rec.abort();
        } catch {
          /* já parado */
        }
        setListening(false);
        setInterim("");
        setPreview("");
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (ev: any) => {
      if (session !== sessionRef.current) return;
      let interimText = "";
      const finals: string[] = [];
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const transcript = cleanTranscript(r?.[0]?.transcript ?? "");
        if (!transcript) continue;
        if (r.isFinal) {
          if (processedFinalIndexesRef.current.has(i)) continue;
          processedFinalIndexesRef.current.add(i);
          finals.push(transcript);
        } else {
          interimText += ` ${transcript}`;
        }
      }
      setInterim(cleanTranscript(interimText));
      for (const finalText of finals) {
        const f = collapseLikelyEcho(finalText);
        if (!shouldAcceptFinal(f)) continue;
        appendPreview(f);
        onFinalRef.current(f);
      }
    };
    try {
      recRef.current = rec;
      rec.start();
      return true;
    } catch {
      if (recRef.current === rec) recRef.current = null;
      startingRef.current = false;
      return false;
    }
  }, [appendPreview, clearRestartTimer, shouldAcceptFinal]);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    wantedRef.current = false;
    mutedRef.current = false;
    setMuted(false);
    setInterim("");
    setPreview("");
    stopRec();
    setListening(false);
  }, [stopRec]);

  const start = useCallback(() => {
    sessionRef.current += 1;
    recentFinalsRef.current = [];
    wantedRef.current = true;
    mutedRef.current = false;
    setMuted(false);
    return startRec();
  }, [startRec]);

  const mute = useCallback(() => {
    if (!wantedRef.current) return;
    sessionRef.current += 1;
    mutedRef.current = true;
    setMuted(true);
    setInterim("");
    setPreview("");
    stopRec(); // pausa a captura; wantedRef segue true pra retomar
  }, [stopRec]);

  const unmute = useCallback(() => {
    if (!wantedRef.current) return;
    sessionRef.current += 1;
    mutedRef.current = false;
    setMuted(false);
    startRec();
  }, [startRec]);

  const toggle = useCallback(() => {
    if (wantedRef.current) stop();
    else start();
  }, [start, stop]);

  const toggleMute = useCallback(() => {
    if (mutedRef.current) unmute();
    else mute();
  }, [mute, unmute]);

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
