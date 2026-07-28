import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "./_shared";

// Bitmask de dias: Dom=1, Seg=2, Ter=4, Qua=8, Qui=16, Sex=32, Sáb=64.
const DAY_BITS: Record<string, number> = {
  dom: 1,
  seg: 2,
  ter: 4,
  qua: 8,
  qui: 16,
  sex: 32,
  sab: 64,
};

function maskFromDays(days?: string[]): number {
  if (!days?.length) return 127;
  let mask = 0;
  for (const d of days) {
    const key = d
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .slice(0, 3);
    mask |= DAY_BITS[key] ?? 0;
  }
  return mask || 127;
}

export default defineTool({
  name: "create_mission",
  title: "Criar missão / compromisso",
  description:
    "Cria uma missão (compromisso) para o usuário autenticado: diária, semanal em dias específicos, ou pontual (one_off).",
  inputSchema: {
    title: z.string().describe("Título do compromisso. Ex.: 'Treino de força'."),
    mission_type: z
      .enum(["daily", "weekly", "one_off"])
      .optional()
      .describe("Tipo. Padrão 'daily'. Use 'one_off' para algo pontual de hoje."),
    days: z
      .array(z.string())
      .optional()
      .describe(
        "Dias da semana quando mission_type='weekly'. Use: dom, seg, ter, qua, qui, sex, sab.",
      ),
    scheduled_time: z
      .string()
      .optional()
      .describe("Horário de início no formato HH:MM."),
    end_time: z.string().optional().describe("Horário de fim no formato HH:MM."),
    area_slug: z
      .string()
      .optional()
      .describe("Área: treino, cozinha, quarto, casa, mental, inclusao."),
    notes: z.string().optional().describe("Observações livres."),
    remind_before_min: z
      .number()
      .int()
      .optional()
      .describe("Minutos de antecedência do lembrete. Padrão 10."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const err = requireAuth(ctx);
    if (err) return err;
    const clean = input.title.trim();
    if (!clean) {
      return { content: [{ type: "text", text: "Título vazio." }], isError: true };
    }
    const type = input.mission_type ?? "daily";
    const time = input.scheduled_time?.trim();
    const end = input.end_time?.trim();
    const hhmm = /^\d{2}:\d{2}$/;
    if (time && !hhmm.test(time)) {
      return {
        content: [{ type: "text", text: "scheduled_time inválido. Use HH:MM." }],
        isError: true,
      };
    }
    if (end && !hhmm.test(end)) {
      return {
        content: [{ type: "text", text: "end_time inválido. Use HH:MM." }],
        isError: true,
      };
    }

    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("user_missions")
      .insert({
        user_id: ctx.getUserId()!,
        title: clean.slice(0, 160),
        mission_type: type,
        weekday_mask: type === "weekly" ? maskFromDays(input.days) : 127,
        scheduled_time: time ?? null,
        end_time: end ?? null,
        area_slug: input.area_slug?.trim() || null,
        notes: input.notes?.trim() || null,
        remind_before_min: Math.max(0, Math.round(input.remind_before_min ?? 10)),
        active: true,
      })
      .select("id, title, mission_type, weekday_mask, scheduled_time, area_slug")
      .single();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [
        {
          type: "text",
          text: `Compromisso criado: ${data.title}${data.scheduled_time ? ` às ${data.scheduled_time}` : ""} (${data.mission_type}).`,
        },
      ],
      structuredContent: { mission: data },
    };
  },
});
