import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "./_shared";

export default defineTool({
  name: "complete_mission",
  title: "Concluir missão",
  description:
    "Marca uma missão como concluída na data informada (padrão hoje) e dispara o XP. Use list_missions para obter o mission_id.",
  inputSchema: {
    mission_id: z.string().describe("ID da missão (vem de list_missions)."),
    date: z.string().optional().describe("Data AAAA-MM-DD. Padrão: hoje."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ mission_id, date }, ctx) => {
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
      .from("user_mission_logs")
      .select("id, done")
      .eq("mission_id", mission_id)
      .eq("user_id", userId)
      .eq("log_date", logDate)
      .maybeSingle();

    if (existing?.done) {
      return {
        content: [{ type: "text", text: `Já estava concluída em ${logDate}.` }],
        structuredContent: { log_id: existing.id, already: true, date: logDate },
      };
    }

    if (existing) {
      const { error } = await sb
        .from("user_mission_logs")
        .update({ done: true, done_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error)
        return { content: [{ type: "text", text: error.message }], isError: true };
      return {
        content: [{ type: "text", text: `Missão concluída em ${logDate}.` }],
        structuredContent: { log_id: existing.id, already: false, date: logDate },
      };
    }

    const { data, error } = await sb
      .from("user_mission_logs")
      .insert({
        mission_id,
        user_id: userId,
        log_date: logDate,
        done: true,
        done_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Missão concluída em ${logDate}.` }],
      structuredContent: { log_id: data.id, already: false, date: logDate },
    };
  },
});
