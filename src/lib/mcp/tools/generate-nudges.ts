import { defineTool } from "@lovable.dev/mcp-js";
import { requireAuth, supabaseForUser } from "./_shared";

export default defineTool({
  name: "generate_nudges",
  title: "Gerar nudges do dia",
  description:
    "Roda o motor de nudges para o usuário autenticado (missões pendentes, streak em risco, rituais do dia). Retorna quantas notificações foram criadas.",
  inputSchema: {},
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.rpc("generate_my_nudges");
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    const inserted = (data as number | null) ?? 0;
    return {
      content: [{ type: "text", text: `Nudges criados: ${inserted}` }],
      structuredContent: { inserted },
    };
  },
});
