import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createChatModelWithFallback } from "@/lib/ai-gateway.server";

// Endpoint temporário só para verificar se o modelo de chat do AI Gateway
// aceita imagem como entrada (spike antes de construir o registro de
// alimento por foto). Remover depois do teste.
export const Route = createFileRoute("/api/test-vision")({
  server: {
    handlers: {
      GET: async () => {
        if (!process.env.OPENAI_API_KEY && !process.env.LOVABLE_API_KEY) {
          return new Response("Missing AI key", { status: 500 });
        }
        const model = createChatModelWithFallback(process.env.LOVABLE_API_KEY);
        try {
          const res = await generateText({
            model,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "O que é este alimento e qual sua estimativa de calorias totais? Responda em português, em uma frase curta.",
                  },
                  {
                    type: "image",
                    image: new URL(
                      "https://upload.wikimedia.org/wikipedia/commons/9/91/Pizza-3007395.jpg",
                    ),
                  },
                ],
              },
            ],
          });
          return Response.json({ ok: true, text: res.text });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : String(err) },
            { status: 500 },
          );
        }
      },
    },
  },
});
