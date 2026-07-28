import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "./_shared";

export default defineTool({
  name: "undo_completion",
  title: "Desfazer conclusão",
  description:
    "Desfaz um check-in feito por engano: remove o registro de conclusão de uma missão ou de um hábito na data informada (padrão hoje).",
  inputSchema: {
    kind: z.enum(["mission", "habit"]).describe("O que desfazer."),
    id: z.string().describe("mission_id ou habit_id, conforme 'kind'."),
    date: z.string().optional().describe("Data AAAA-MM-DD. Padrão: hoje."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ kind, id, date }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const logDate = (date ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
      return {
        content: [{ type: "text", text: "Data inválida. Use AAAA-MM-DD." }],
        isError: true,
      };
    }
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;

    const { data: rows, error } =
      kind === "mission"
        ? await sb
            .from("user_mission_logs")
            .delete()
            .eq("mission_id", id)
            .eq("user_id", userId)
            .eq("log_date", logDate)
            .select("id")
        : await sb
            .from("habit_logs")
            .delete()
            .eq("habit_id", id)
            .eq("user_id", userId)
            .eq("log_date", logDate)
            .select("id");
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    const removed = rows?.length ?? 0;
    return {
      content: [
        {
          type: "text",
          text: removed
            ? `Conclusão desfeita em ${logDate}.`
            : `Nenhum registro encontrado em ${logDate}.`,
        },
      ],
      structuredContent: { removed, date: logDate },
    };
  },
});
