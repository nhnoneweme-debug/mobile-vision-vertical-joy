import { useCallback, useEffect, useRef, useState } from "react";

// Reconhecimento de fala (Web Speech API) em pt-BR, contínuo — a pessoa fala e
// o texto final vai caindo no callback. Usado pelo chat da IA e pelos dumps.
//
// `mute()` pausa a captura sem encerrar a "sessão" lógica: o usuário pode
// silenciar pra atender alguém e retomar sem perder o que já foi transcrito.
// `interim` expõe o texto parcial pra UI mostrar o acompanhamento ao vivo.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recognition = any;

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
  const recRef = useRef<Recognition>(null);
  const wantedRef = useRef(false);
  const mutedRef = useRef(false);
  const onFinalRef = useRef(onFinalText);
  onFinalRef.current = onFinalText;

  useEffect(() => {
    setSupported(!!getSpeechRecognition());
  }, []);

  const stopRec = useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      try {
        rec.abort();
      } catch {
        /* já parado */
      }
      recRef.current = null;
    }
  }, []);

  const startRec = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR || recRef.current) return false;
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => setListening(true);
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      setInterim("");
      // Religa se o usuário não mandou parar nem mutou (silêncio encerra a sessão).
      if (wantedRef.current && !mutedRef.current) {
        try {
          rec.start();
          recRef.current = rec;
        } catch {
          wantedRef.current = false;
        }
      }
    };
    rec.onerror = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (ev: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText.trim());
      if (finalText.trim()) onFinalRef.current(finalText.trim());
    };
    try {
      rec.start();
      recRef.current = rec;
      return true;
    } catch {
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    wantedRef.current = false;
    mutedRef.current = false;
    setMuted(false);
    setInterim("");
    stopRec();
    setListening(false);
  }, [stopRec]);

  const start = useCallback(() => {
    wantedRef.current = true;
    mutedRef.current = false;
    setMuted(false);
    return startRec();
  }, [startRec]);

  const mute = useCallback(() => {
    if (!wantedRef.current) return;
    mutedRef.current = true;
    setMuted(true);
    setInterim("");
    stopRec(); // pausa a captura; wantedRef segue true pra retomar
  }, [stopRec]);

  const unmute = useCallback(() => {
    if (!wantedRef.current) return;
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

  return { listening, supported, muted, interim, start, stop, toggle, mute, unmute, toggleMute };
}
