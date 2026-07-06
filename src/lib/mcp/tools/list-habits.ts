import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "./_shared";

export default defineTool({
  name: "list_habits",
  title: "Listar hábitos",
  description:
    "Lista os hábitos ativos do usuário autenticado com meta semanal.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Máximo. Padrão 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("habits")
      .select("id, title, target_per_week, xp_reward, active")
      .eq("user_id", ctx.getUserId()!)
      .eq("active", true)
      .limit(limit ?? 50);
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { habits: data ?? [] },
    };
  },
});
