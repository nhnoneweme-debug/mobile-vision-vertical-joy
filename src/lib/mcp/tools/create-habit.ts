import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "./_shared";

export default defineTool({
  name: "create_habit",
  title: "Criar hábito",
  description:
    "Cria um novo hábito para o usuário autenticado, com meta semanal e área opcional.",
  inputSchema: {
    title: z.string().describe("Título curto do hábito. Ex.: 'Beber 2L de água'."),
    target_per_week: z
      .number()
      .int()
      .optional()
      .describe("Quantas vezes por semana (1 a 7). Padrão 7."),
    area_slug: z
      .string()
      .optional()
      .describe(
        "Área do app: treino, cozinha, quarto, casa, mental, inclusao. Padrão 'casa'.",
      ),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, target_per_week, area_slug }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const clean = title.trim();
    if (!clean) {
      return { content: [{ type: "text", text: "Título vazio." }], isError: true };
    }
    const target = Math.min(7, Math.max(1, Math.round(target_per_week ?? 7)));
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("habits")
      .insert({
        user_id: ctx.getUserId()!,
        title: clean.slice(0, 120),
        target_per_week: target,
        target: target,
        area_slug: area_slug?.trim() || "casa",
        active: true,
      })
      .select("id, title, target_per_week, area_slug")
      .single();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [
        {
          type: "text",
          text: `Hábito criado: ${data.title} (${data.target_per_week}x/semana, área ${data.area_slug}).`,
        },
      ],
      structuredContent: { habit: data },
    };
  },
});
