// Sincroniza a agenda de notificações das Ações (segundo plano).
// O cliente calcula as ocorrências no fuso do aparelho (camada 3.9.4) e o
// servidor regrava as linhas pendentes futuras do usuário.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  tz: z.string().max(64).default("UTC"),
  occurrences: z
    .array(
      z.object({
        trigger_id: z.string().uuid(),
        fire_at: z.string().min(10).max(40),
        title: z.string().max(160),
        body: z.string().max(400),
      }),
    )
    .max(200),
});

export const syncActionPushSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();

    // limpa a agenda futura ainda não enviada e regrava a partir do estado atual
    await supabase
      .from("action_push_schedule")
      .delete()
      .eq("user_id", userId)
      .is("sent_at", null)
      .gt("fire_at", nowIso);

    if (data.occurrences.length === 0) return { ok: true, scheduled: 0 };

    const rows = data.occurrences.map((o) => ({
      user_id: userId,
      trigger_id: o.trigger_id,
      fire_at: o.fire_at,
      tz: data.tz,
      title: o.title,
      body: o.body,
    }));

    const { error } = await supabase
      .from("action_push_schedule")
      .upsert(rows, { onConflict: "trigger_id,fire_at", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true, scheduled: rows.length };
  });
