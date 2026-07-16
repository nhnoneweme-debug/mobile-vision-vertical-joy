import { createFileRoute } from "@tanstack/react-router";
import { checkRateLimit } from "@/lib/ai-guardrails.server";

const json = (obj: unknown, status: number) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

// Vozes OpenAI escolhidas por gênero. gpt-4o-mini-tts fala pt-BR quando o
// texto está em português e a instrução reforça o sotaque brasileiro.
const VOICE_BY_GENDER: Record<"feminina" | "masculina", string> = {
  feminina: "nova",
  masculina: "onyx",
};

// Overrides opcionais para o ElevenLabs (rota alternativa).
function elevenVoiceByGender(gender: "feminina" | "masculina"): string {
  if (gender === "masculina") {
    return process.env.ELEVENLABS_VOICE_ID_PTBR_MALE || "onwK4e9ZLuTAKqWW03F9"; // Daniel
  }
  return process.env.ELEVENLABS_VOICE_ID_PTBR_FEMALE || "EXAVITQu4vr4xnSDxMaL"; // Sarah (multilingual)
}

export const Route = createFileRoute("/api/assistant-tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth obrigatório (evita abuso anônimo da quota de voz).
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
        const token = auth.slice(7);
        let userId: string;
        try {
          const { createClient } = await import("@supabase/supabase-js");
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
          );
          const { data: claims, error } = await supabase.auth.getClaims(token);
          if (error || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
          userId = claims.claims.sub as string;
        } catch {
          return json({ error: "Unauthorized" }, 401);
        }

        const rl = checkRateLimit(`tts:${userId}`);
        if (!rl.ok) return json({ error: rl.message }, 429);

        let body: { text?: string; gender?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "JSON inválido" }, 400);
        }
        const text = body.text?.trim();
        if (!text) return json({ error: "texto vazio" }, 400);
        const gender: "feminina" | "masculina" =
          body.gender === "masculina" ? "masculina" : "feminina";

        // Rota 1: ElevenLabs (se configurado) — vozes pt-BR por gênero.
        const elevenKey = process.env.ELEVENLABS_API_KEY;
        if (elevenKey) {
          const voiceId = elevenVoiceByGender(gender);
          try {
            const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
              method: "POST",
              headers: {
                "xi-api-key": elevenKey,
                "Content-Type": "application/json",
                Accept: "audio/mpeg",
              },
              body: JSON.stringify({
                text: text.slice(0, 5000),
                model_id: "eleven_multilingual_v2",
                language_code: "pt",
                voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
              }),
            });
            if (res.ok) {
              const audioBuf = await res.arrayBuffer();
              return new Response(audioBuf, {
                headers: {
                  "Content-Type": "audio/mpeg",
                  "Content-Length": String(audioBuf.byteLength),
                },
              });
            }
            // Se ElevenLabs falhar, cai pro Lovable AI Gateway abaixo.
          } catch {
            /* tenta gateway */
          }
        }

        // Rota 2: Lovable AI Gateway (openai/gpt-4o-mini-tts).
        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) return json({ error: "TTS indisponível" }, 501);

        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini-tts",
              input: text.slice(0, 4000),
              voice: VOICE_BY_GENDER[gender],
              instructions:
                "Fale em português do Brasil (pt-BR), com sotaque brasileiro natural, tom caloroso e ritmo tranquilo.",
              response_format: "mp3",
            }),
          });
          if (!res.ok) {
            const errText = await res.text();
            return json({ error: "TTS falhou", status: res.status, detail: errText }, 502);
          }
          const audioBuf = await res.arrayBuffer();
          return new Response(audioBuf, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Content-Length": String(audioBuf.byteLength),
            },
          });
        } catch (err) {
          return json({ error: "erro de rede", detail: String(err) }, 500);
        }
      },
    },
  },
});
