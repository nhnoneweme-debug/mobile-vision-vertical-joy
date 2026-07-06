import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "./_shared";

export default defineTool({
  name: "get_profile",
  title: "Meu perfil",
  description:
    "Retorna o perfil do usuário autenticado (nome, classe, XP, streak, brasas, nível, objetivo).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("profiles")
      .select(
        "display_name, behavioral_class, xp, streak, brasas, level, goal, level_track, friend_code",
      )
      .eq("id", ctx.getUserId()!)
      .maybeSingle();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? {}, null, 2) }],
      structuredContent: { profile: data ?? {} },
    };
  },
});

// silence unused-import warning; z is available for tools that need it later
void z;
