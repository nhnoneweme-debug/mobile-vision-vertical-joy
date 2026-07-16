import { createFileRoute } from "@tanstack/react-router";
import { checkRateLimit } from "@/lib/ai-guardrails.server";

const json = (obj: unknown, status: number) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/assistant-tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
        // Sem chave: mantém o fallback (o cliente usa Web Speech). Antes da auth
        // pra não vazar exigência de token quando o recurso nem está ativo.
        if (!apiKey) return json({ error: "ElevenLabs não configurado" }, 501);

        // Exige usuário autenticado (evita abuso anônimo da quota de voz).
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

        // Rate limit próprio pra TTS (bucket separado do chat).
        const rl = checkRateLimit(`tts:${userId}`);
        if (!rl.ok) return json({ error: rl.message }, 429);

        let body: { text?: string };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
        }
        const text = body.text?.trim();
        if (!text) return new Response(JSON.stringify({ error: "texto vazio" }), { status: 400 });

        try {
          const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: "POST",
            headers: {
              "xi-api-key": apiKey,
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({
              text: text.slice(0, 5000),
              model_id: "eleven_multilingual_v2",
              voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
            }),
          });
          if (!res.ok) {
            const errText = await res.text();
            return new Response(
              JSON.stringify({ error: "ElevenLabs falhou", status: res.status, detail: errText }),
              { status: 502, headers: { "Content-Type": "application/json" } },
            );
          }
          const audioBuf = await res.arrayBuffer();
          return new Response(audioBuf, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Content-Length": String(audioBuf.byteLength),
            },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: "erro de rede", detail: String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
