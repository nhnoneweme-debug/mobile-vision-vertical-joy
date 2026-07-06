import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "./_shared";

export default defineTool({
  name: "list_notifications",
  title: "Listar notificações",
  description:
    "Lista as notificações mais recentes do usuário autenticado.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Máximo. Padrão 20."),
    only_unread: z.boolean().optional().describe("Se true, retorna apenas não-lidas."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, only_unread }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("notifications")
      .select("id, kind, title, body, link, read_at, created_at")
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (only_unread) q = q.is("read_at", null);
    const { data, error } = await q;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { notifications: data ?? [] },
    };
  },
});
