import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "./_shared";

export default defineTool({
  name: "log_habit",
  title: "Registrar hábito",
  description:
    "Registra a conclusão de um hábito em uma data (padrão hoje). Use list_habits antes para obter o habit_id.",
  inputSchema: {
    habit_id: z.string().describe("ID do hábito (vem de list_habits)."),
    date: z
      .string()
      .optional()
      .describe("Data no formato AAAA-MM-DD. Padrão: hoje."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ habit_id, date }, ctx) => {
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

    const { data: existing } = await sb
      .from("habit_logs")
      .select("id")
      .eq("habit_id", habit_id)
      .eq("user_id", userId)
      .eq("log_date", logDate)
      .maybeSingle();
    if (existing) {
      return {
        content: [{ type: "text", text: `Já registrado em ${logDate}.` }],
        structuredContent: { log_id: existing.id, already: true, date: logDate },
      };
    }

    const { data, error } = await sb
      .from("habit_logs")
      .insert({
        habit_id,
        user_id: userId,
        log_date: logDate,
        status: "completed",
      })
      .select("id, log_date")
      .single();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Hábito registrado em ${data.log_date}.` }],
      structuredContent: { log_id: data.id, already: false, date: data.log_date },
    };
  },
});
