import { createFileRoute } from "@tanstack/react-router";
import { checkRateLimit } from "@/lib/ai-guardrails.server";

// TTS de servidor da WiMi (Camada 3.6).
// Usa o conector de IA embutido do Lovable (LOVABLE_API_KEY, gerenciada pela
// plataforma) com o modelo `openai/gpt-4o-mini-tts`. A credencial NUNCA sai do
// servidor. Devolve audio/mpeg puro; erros vêm em JSON com `code` para o
// cliente decidir o fallback (voz do aparelho) sem ruído na interface.

const json = (obj: unknown, status: number) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

const MAX_CHARS = 600;

export const SERVER_VOICES = ["nova", "alloy", "shimmer", "onyx", "echo", "fable"] as const;

const INSTRUCTIONS: Record<string, string> = {
  pt: "Fale em português do Brasil (pt-BR), com sotaque brasileiro natural, tom caloroso e ritmo tranquilo.",
  en: "Speak in natural American English, warm and calm.",
  es: "Habla en español neutro, con tono cálido y ritmo tranquilo.",
};

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized", code: 401 }, 401);
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
          if (error || !claims?.claims?.sub) return json({ error: "Unauthorized", code: 401 }, 401);
          userId = claims.claims.sub as string;
        } catch {
          return json({ error: "Unauthorized", code: 401 }, 401);
        }

        const rl = checkRateLimit(`tts:${userId}`);
        if (!rl.ok) return json({ error: rl.message, code: 429 }, 429);

        let body: { text?: string; lang?: string; voice?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "JSON inválido", code: 400 }, 400);
        }
        const text = body.text?.trim().slice(0, MAX_CHARS);
        if (!text) return json({ error: "texto vazio", code: 400 }, 400);
        const base = (body.lang ?? "pt-BR").slice(0, 2).toLowerCase();
        const voice = (SERVER_VOICES as readonly string[]).includes(body.voice ?? "")
          ? body.voice!
          : "nova";

        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) return json({ error: "TTS indisponível", code: 501 }, 501);

        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini-tts",
              input: text,
              voice,
              instructions: INSTRUCTIONS[base] ?? INSTRUCTIONS.pt,
              response_format: "mp3",
            }),
          });
          if (res.status === 402) {
            return json({ error: "sem saldo de IA", code: 402 }, 402);
          }
          if (res.status === 429) {
            return json({ error: "limite de uso atingido", code: 429 }, 429);
          }
          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            return json({ error: "TTS falhou", code: 502, detail }, 502);
          }
          const audioBuf = await res.arrayBuffer();
          return new Response(audioBuf, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Content-Length": String(audioBuf.byteLength),
              "Cache-Control": "private, max-age=86400",
            },
          });
        } catch (err) {
          return json({ error: "erro de rede", code: 503, detail: String(err) }, 503);
        }
      },
    },
  },
});
