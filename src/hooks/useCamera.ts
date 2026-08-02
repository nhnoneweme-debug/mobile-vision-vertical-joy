// Câmera ao vivo do painel Live.
//
// Só abre o olho: getUserMedia + preview. Nenhum frame é capturado, enviado a
// modelo ou persistido nesta fatia. Alterna frontal/traseira sem recarregar a
// tela e devolve estados honestos (pedindo permissão / negada / sem suporte).

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraFacing = "user" | "environment";
export type CameraStatus = "idle" | "requesting" | "live" | "denied" | "unsupported" | "error";

export function useCamera() {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [facing, setFacing] = useState<CameraFacing>("environment");
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus((s) => (s === "unsupported" ? s : "idle"));
  }, []);

  const startWith = useCallback(async (mode: CameraFacing) => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return false;
    }
    setStatus("requesting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: false,
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => {});
      }
      setFacing(mode);
      setStatus("live");
      return true;
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setStatus("denied");
        setError("Permissão de câmera negada. Libere nas configurações do navegador.");
      } else {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Não foi possível abrir a câmera.");
      }
      return false;
    }
  }, []);

  const start = useCallback(() => startWith(facing), [facing, startWith]);

  const toggle = useCallback(() => {
    if (streamRef.current) {
      stop();
      return Promise.resolve(false);
    }
    return startWith(facing);
  }, [facing, startWith, stop]);

  const flip = useCallback(() => {
    const next: CameraFacing = facing === "user" ? "environment" : "user";
    if (!streamRef.current) {
      setFacing(next);
      return Promise.resolve(false);
    }
    return startWith(next);
  }, [facing, startWith]);

  // Reanexa o stream se o elemento <video> for remontado (ex.: modo estação).
  const attach = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      void el.play().catch(() => {});
    }
  }, []);

  /**
   * Captura o quadro atual do preview como JPEG. Só isso — nenhum frame sai
   * daqui sozinho; quem chama decide o que fazer com o blob.
   */
  const capture = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
    });
  }, []);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    },
    [],
  );

  return {
    status,
    live: status === "live",
    facing,
    error,
    attach,
    capture,
    start,
    stop,
    toggle,
    flip,
  };
}

