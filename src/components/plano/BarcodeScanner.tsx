import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";

// Overlay de leitura de código de barras pela câmera. Usa @zxing/browser, que
// funciona em Android, iOS (Safari) e desktop. Prefere a câmera traseira.
export function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const detectedRef = useRef(false);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let controls: { stop: () => void } | null = null;
    let cancelled = false;

    (async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video,
          (result) => {
            if (!result || detectedRef.current) return;
            detectedRef.current = true;
            const code = result.getText().replace(/\D/g, "");
            controls?.stop();
            if (code.length >= 6) onDetected(code);
          },
        );
        if (cancelled) controls.stop();
      } catch (e) {
        const denied = e instanceof DOMException && e.name === "NotAllowedError";
        setError(
          denied
            ? "Permissão de câmera negada. Feche e digite o código manualmente."
            : "Não consegui abrir a câmera. Feche e digite o código manualmente.",
        );
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div
        className="flex items-center justify-between px-4 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <span className="font-display text-sm tracking-[0.2em] text-white">ESCANEIE O CÓDIGO</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar scanner"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-72 max-w-[80%] rounded-2xl border-2 border-ember/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>
        )}
        {error && (
          <div className="absolute inset-x-4 bottom-10 rounded-xl bg-black/85 p-4 text-center text-sm text-white">
            {error}
          </div>
        )}
      </div>

      <div
        className="px-4 pt-3 text-center text-xs text-white/70"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        Aponte para o código de barras do produto
      </div>
    </div>
  );
}
