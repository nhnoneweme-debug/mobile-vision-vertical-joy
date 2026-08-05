// Cron das AÇÕES: envia a notificação das ações de horário vencidas.
//
// Roda de minuto em minuto (pg_cron) e autentica por `x-webhook-secret`.
// Deep link: /executar?seed=action:<trigger_id> — ao tocar, o app abre e
// executa o que faltava (falar, abrir o log de jornada, etc.).

import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/hooks/actions-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-webhook-secret") ?? "";
        const expected = process.env.WEBHOOK_SECRET ?? "";
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPushToUser } = await import("@/lib/push.server");

        const nowIso = new Date().toISOString();
        const { data, error } = await supabaseAdmin
          .from("action_push_schedule")
          .select("id, user_id, trigger_id, fire_at, title, body")
          .lte("fire_at", nowIso)
          .is("sent_at", null)
          .order("fire_at", { ascending: true })
          .limit(200);

        if (error) {
          console.error("actions-tick read failed", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const rows = data ?? [];
        let sent = 0;
        let skipped = 0;
        let failed = 0;

        for (const row of rows) {
          try {
            const r = await sendPushToUser(row.user_id, {
              title: row.title ?? "WiMi",
              body: row.body ?? "Uma ação sua chegou a hora.",
              url: `/executar?seed=action:${row.trigger_id}`,
              kind: "mission_due",
              tag: `action:${row.trigger_id}`,
            });
            if (r.skipped) skipped += 1;
            else sent += r.sent;
          } catch (e) {
            console.error("actions-tick send failed", e);
            failed += 1;
          }
          await supabaseAdmin
            .from("action_push_schedule")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", row.id);
        }

        return new Response(
          JSON.stringify({ ok: true, processed: rows.length, sent, skipped, failed }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
