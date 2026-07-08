import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createChatModelWithFallback } from "@/lib/ai-gateway.server";

export type SuggestedRitual = {
  title: string;
  scheduled_time: string | null; // "HH:MM"
  notes: string;
};

const Suggestions = z.object({
  rituals: z
    .array(
      z.object({
        title: z.string().min(2).max(80),
        scheduled_time: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .nullable()
          .optional(),
        notes: z.string().max(200).optional(),
      }),
    )
    .min(2)
    .max(6),
});

export const suggestQuartoRituals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!process.env.OPENAI_API_KEY && !LOVABLE_API_KEY) throw new Error("Missing AI key");

    const [{ data: profile }, { data: sleep }, { data: inclusionRow }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("display_name,goal,behavioral_class,age")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("sleep_logs")
        .select("date,quality,bed_at,wake_at,notes")
        .eq("user_id", context.userId)
        .order("date", { ascending: false })
        .limit(7),
      context.supabase
        .from("area_progress")
        .select("meta")
        .eq("user_id", context.userId)
        .eq("area_slug", "inclusao")
        .maybeSingle(),
    ]);

    const inclusion = ((inclusionRow?.meta ?? {}) as Record<string, unknown>).inclusion as
      | { pronouns?: string; ia_tone?: string; no_go_topics?: string }
      | undefined;

    const model = createChatModelWithFallback(LOVABLE_API_KEY);

    const sys = [
      "Você sugere rituais noturnos personalizados (higiene do sono, ambiente, mente).",
      "Devolva APENAS JSON válido no formato:",
      '{ "rituals": [{ "title": "Beber um copo d\'água", "scheduled_time": "22:30", "notes": "hidratação leve" }] }',
      "3 a 5 rituais, títulos curtos (até 6 palavras), horários realistas entre 20:00-23:30.",
      "Respeite inclusão/pronomes/temas evitados quando fornecidos.",
      "Sem prosa, sem markdown.",
    ].join("\n");

    const user = [
      `Perfil: ${profile?.display_name ?? "Viajante"}, classe ${profile?.behavioral_class ?? "?"}, objetivo ${profile?.goal ?? "?"}, idade ${profile?.age ?? "?"}.`,
      inclusion?.pronouns ? `Pronomes: ${inclusion.pronouns}.` : "",
      inclusion?.ia_tone ? `Tom: ${inclusion.ia_tone}.` : "",
      inclusion?.no_go_topics ? `Evitar: ${inclusion.no_go_topics}.` : "",
      `Sono recente (últimos ${sleep?.length ?? 0} dias):`,
      ...(sleep ?? []).map(
        (s) =>
          `- ${s.date}: qualidade ${s.quality ?? "?"}/5${s.bed_at ? ` deitou ${s.bed_at}` : ""}${s.wake_at ? ` acordou ${s.wake_at}` : ""}${s.notes ? ` obs: ${s.notes}` : ""}`,
      ),
      "Gere rituais que respondam aos padrões observados.",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await generateText({
      model,
      system: sys,
      messages: [{ role: "user", content: user }],
    });

    const cleaned = res.text.trim().replace(/^```json\s*|\s*```$/g, "");
    const parsed = Suggestions.parse(JSON.parse(cleaned));
    return parsed.rituals.map<SuggestedRitual>((r) => ({
      title: r.title,
      scheduled_time: r.scheduled_time ?? null,
      notes: r.notes ?? "",
    }));
  });
