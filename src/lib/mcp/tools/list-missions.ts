import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "./_shared";

export default defineTool({
  name: "list_missions",
  title: "Listar missões",
  description:
    "Lista as missões ativas do usuário autenticado, com horário e área. Marca as concluídas hoje.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Máximo de missões a retornar. Padrão 25."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: missions, error }, { data: logs }] = await Promise.all([
      sb
        .from("user_missions")
        .select("id, title, area_slug, scheduled_time, weekday_mask, active")
        .eq("user_id", userId)
        .eq("active", true)
        .limit(limit ?? 25),
      sb
        .from("user_mission_logs")
        .select("mission_id, done")
        .eq("user_id", userId)
        .eq("log_date", today),
    ]);
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    const doneSet = new Set(
      (logs ?? []).filter((l) => l.done).map((l) => l.mission_id),
    );
    const items = (missions ?? []).map((m) => ({
      ...m,
      done_today: doneSet.has(m.id),
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
      structuredContent: { missions: items },
    };
  },
});
