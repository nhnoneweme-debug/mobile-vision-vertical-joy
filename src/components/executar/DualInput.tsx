// Caixa dual: FALAR ou DIGITAR, sempre lado a lado.
// Regra transversal da Fatia 3.1 — todo ponto de conversa com a IA usa isto.

import { useCallback, useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { useSpeechToText } from "@/hooks/useSpeechToText";

export function DualInput({
  value,
  onChange,
  placeholder,
  rows = 3,
  autoFocus,
  lang = "pt-BR",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  lang?: string;
}) {
  const valueRef = useRef(value);
  valueRef.current = value;

  const onFinal = useCallback(
    (text: string) => {
      const next = `${valueRef.current} ${text}`.trim().replace(/\s+/g, " ");
      onChange(next);
    },
    [onChange],
  );

  const speech = useSpeechToText(onFinal, { lang });

  // Ao desmontar, o microfone morre junto — nunca fica ouvindo escondido.
  useEffect(() => speech.stop, [speech.stop]);

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <textarea
          value={value}
          autoFocus={autoFocus}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Fale ou escreva…"}
          className="min-h-[64px] flex-1 rounded-xl border border-border bg-charcoal-950/60 px-3 py-2 text-sm text-foreground outline-none focus:border-ember/50"
        />
        <button
          type="button"
          onClick={() => (speech.listening ? speech.stop() : speech.start())}
          disabled={!speech.supported}
          aria-pressed={speech.listening}
          aria-label={speech.listening ? "Parar de falar" : "Falar"}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-95 disabled:opacity-40 ${
            speech.listening
              ? "animate-pulse border-ember/60 bg-ember/15 text-ember"
              : "border-border text-muted-foreground"
          }`}
        >
          {speech.listening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {!speech.supported
          ? "Seu navegador não tem reconhecimento de voz — escreva no campo."
          : speech.listening
            ? speech.interim
              ? `ouvindo: ${speech.interim}`
              : "ouvindo… pode falar."
            : "Toque no microfone para falar ou escreva direto."}
      </p>
    </div>
  );
}
