// Helper compartilhado de TTS da WiMi.
// Toca uma frase via /api/assistant-tts, respeitando gênero de voz preferido.
// Uma única instância global de <audio> evita sobreposição entre chamadas.
// Retorna uma Promise que resolve quando o áudio termina (ou falha silenciosa).

import { supabase } from "@/integrations/supabase/client";

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let currentGen = 0;

function sanitize(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*|__/g, "")
    .replace(/[*_>#]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

export type PlayTtsOptions = {
  gender?: "feminina" | "masculina";
  onStart?: () => void;
  onEnd?: () => void;
};

export function stopAssistantTts(): void {
  currentGen += 1;
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = "";
    } catch {
      /* noop */
    }
  }
  if (currentUrl) {
    try {
      URL.revokeObjectURL(currentUrl);
    } catch {
      /* noop */
    }
    currentUrl = null;
  }
  currentAudio = null;
}

export async function playAssistantTts(text: string, opts: PlayTtsOptions = {}): Promise<void> {
  const cleaned = sanitize(text);
  if (!cleaned) return;
  stopAssistantTts();
  const gen = ++currentGen;

  let token: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
  } catch {
    /* segue sem token — o endpoint retornará 401 */
  }
  if (gen !== currentGen) return;

  let res: Response;
  try {
    res = await fetch("/api/assistant-tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text: cleaned, gender: opts.gender ?? "feminina" }),
    });
  } catch {
    return;
  }
  if (gen !== currentGen) return;
  if (!res.ok) return;
  const blob = await res.blob();
  if (gen !== currentGen || blob.size === 0) return;
  const url = URL.createObjectURL(blob);
  currentUrl = url;
  const audio = new Audio(url);
  audio.preload = "auto";
  currentAudio = audio;

  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      opts.onEnd?.();
      resolve();
    };
    audio.onplay = () => opts.onStart?.();
    audio.onended = finish;
    audio.onerror = finish;
    audio.play().catch(finish);
    // Fallback caso o navegador nunca dispare ended (ex: aba escondida)
    window.setTimeout(finish, 60_000);
  });
}
