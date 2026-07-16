import { useCallback, useEffect, useRef, useState } from "react";

// Reconhecimento de fala (Web Speech API) em pt-BR, contínuo — a pessoa fala e
// o texto final vai caindo no callback. Usado pelo chat da IA e pelos dumps.
//
// O navegador encerra a sessão sozinho depois de um tempo de silêncio; o
// `wantedRef` guarda a intenção do usuário pra religar sem depender de closure
// (ler o state dentro do onend pegaria o valor do render em que ligamos).

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
  const recRef = useRef<Recognition>(null);
  const wantedRef = useRef(false);
  const onFinalRef = useRef(onFinalText);
  onFinalRef.current = onFinalText;

  // Só dá pra checar suporte no cliente (SSR não tem window).
  useEffect(() => {
    setSupported(!!getSpeechRecognition());
  }, []);

  const stop = useCallback(() => {
    wantedRef.current = false;
    const rec = recRef.current;
    if (rec) {
      try {
        rec.abort();
      } catch {
        /* já parado */
      }
      recRef.current = null;
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
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
      // Religa se o usuário não mandou parar (silêncio encerra a sessão).
      if (wantedRef.current) {
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
      let transcript = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) transcript += ev.results[i][0].transcript;
      }
      if (transcript.trim()) onFinalRef.current(transcript.trim());
    };
    try {
      wantedRef.current = true;
      rec.start();
      recRef.current = rec;
      return true;
    } catch {
      wantedRef.current = false;
      return false;
    }
  }, []);

  const toggle = useCallback(() => {
    if (wantedRef.current) stop();
    else start();
  }, [start, stop]);

  // Não deixa o microfone aberto ao sair da tela.
  useEffect(() => stop, [stop]);

  return { listening, supported, start, stop, toggle };
}
