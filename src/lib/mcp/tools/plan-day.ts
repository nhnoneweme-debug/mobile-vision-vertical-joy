import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "./_shared";

export default defineTool({
  name: "plan_day",
  title: "Planejar o dia",
  description:
    "Cria em lote os blocos do dia como missões pontuais (one_off), prontas para o palco de execução do Weme.",
  inputSchema: {
    blocks: z
      .array(
        z.object({
          title: z.string().describe("O que será feito nesse bloco."),
          start: z.string().optional().describe("Início HH:MM."),
          end: z.string().optional().describe("Fim HH:MM."),
          area_slug: z
            .string()
            .optional()
            .describe("treino, cozinha, quarto, casa, mental, inclusao."),
          notes: z.string().optional().describe("Detalhe do bloco."),
        }),
      )
      .describe("Lista de blocos do dia, em ordem. Máximo 20."),
    replace_today: z
      .boolean()
      .optional()
      .describe(
        "Se true, desativa os blocos pontuais criados hoje antes de inserir os novos.",
      ),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ blocks, replace_today }, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const hhmm = /^\d{2}:\d{2}$/;
    const items = (blocks ?? []).filter((b) => b.title?.trim()).slice(0, 20);
    if (!items.length) {
      return {
        content: [{ type: "text", text: "Nenhum bloco válido enviado." }],
        isError: true,
      };
    }
    const bad = items.find(
      (b) => (b.start && !hhmm.test(b.start)) || (b.end && !hhmm.test(b.end)),
    );
    if (bad) {
      return {
        content: [
          { type: "text", text: `Horário inválido em "${bad.title}". Use HH:MM.` },
        ],
        isError: true,
      };
    }

    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;

    if (replace_today) {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      await sb
        .from("user_missions")
        .update({ active: false, archived_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("mission_type", "one_off")
        .eq("active", true)
        .gte("created_at", since.toISOString());
    }

    const { data, error } = await sb
      .from("user_missions")
      .insert(
        items.map((b) => ({
          user_id: userId,
          title: b.title.trim().slice(0, 160),
          mission_type: "one_off",
          weekday_mask: 127,
          scheduled_time: b.start ?? null,
          end_time: b.end ?? null,
          area_slug: b.area_slug?.trim() || null,
          notes: b.notes?.trim() || null,
          active: true,
        })),
      )
      .select("id, title, scheduled_time, end_time, area_slug");
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [
        {
          type: "text",
          text: `Dia planejado com ${data?.length ?? 0} blocos:\n${(data ?? [])
            .map((m) => `- ${m.scheduled_time ?? "--:--"} ${m.title}`)
            .join("\n")}`,
        },
      ],
      structuredContent: { missions: data ?? [] },
    };
  },
});
