import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/assistant-tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "ElevenLabs não configurado" }), {
            status: 501,
            headers: { "Content-Type": "application/json" },
          });
        }

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
