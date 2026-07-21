// Cron endpoint: envia push das manifestações vencidas.
//
// Roda de minuto em minuto via pg_cron. Autentica por `x-webhook-secret`
// (mesma variável usada por /api/public/hooks/push-notification). Lê até 200
// linhas de journey_push_schedule com fire_at <= now() e sent_at IS NULL,
// dispara push_to_user (respeita quiet hours e prefs), marca sent_at.

import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/hooks/journey-tick")({
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
          .from("journey_push_schedule")
          .select("id, user_id, mission_id, phase, fire_at, title, body")
          .lte("fire_at", nowIso)
          .is("sent_at", null)
          .order("fire_at", { ascending: true })
          .limit(200);

        if (error) {
          console.error("journey-tick read failed", error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
        const rows = data ?? [];
        if (rows.length === 0) {
          return new Response(JSON.stringify({ ok: true, processed: 0 }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        let sent = 0;
        let skipped = 0;
        let failed = 0;

        for (const row of rows) {
          try {
            const r = await sendPushToUser(row.user_id, {
              title: row.title ?? "WiMi",
              body: row.body ?? "Manifestação da sua jornada.",
              url: `/executar?seed=manifest:${row.mission_id}:${row.phase}`,
              kind: "mission_due",
              tag: `journey:${row.mission_id}:${row.phase}`,
            });
            if (r.skipped) skipped += 1;
            else sent += r.sent;
          } catch (e) {
            console.error("journey-tick send failed", e);
            failed += 1;
          }
          // Marca como enviado de qualquer forma (skip/erro): não retentar em loop.
          await supabaseAdmin
            .from("journey_push_schedule")
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
