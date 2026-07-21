// Sincroniza os avisos de manifestação da jornada com o banco.
//
// O cliente chama esta função sempre que as missões do dia ou os "acordos"
// (preEnd / atEnd / preStart em minutos) mudam. Ela apaga os agendamentos
// futuros ainda não enviados do usuário e re-insere os slots calculados a
// partir das missões do dia. O cron do servidor lê a tabela e envia push.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MissionInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  area: z.string().nullable().optional(),
  scheduled_time: z.string().min(4).max(8), // "HH:MM" ou "HH:MM:SS"
  end_time: z.string().min(4).max(8).nullable().optional(),
});

const InputSchema = z.object({
  tz: z.string().min(1).max(64),
  agreements: z.object({
    preEnd: z.number().int().min(0).max(60),
    atEnd: z.number().int().min(0).max(60),
    preStart: z.number().int().min(0).max(60),
  }),
  notify: z.object({
    text: z.boolean(),
    voice: z.boolean(),
    vibrate: z.boolean(),
    autoMic: z.boolean(),
  }),
  missions: z.array(MissionInput).max(200),
});

type Input = z.infer<typeof InputSchema>;

function parseHM(s: string): { h: number; m: number } | null {
  const [hStr, mStr] = s.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return { h, m };
}

/**
 * Converte "HH:MM" numa Date UTC representando esse horário no fuso `tz`
 * do usuário para HOJE. Trabalha em torno da ausência de Temporal usando
 * Intl.DateTimeFormat para pegar o offset do fuso naquele instante.
 */
function localTodayToUtc(tz: string, h: number, m: number): Date {
  const now = new Date();
  // Guess: monta uma Date como se o fuso fosse UTC.
  const guess = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0));
  // Descobre o offset do fuso `tz` naquele instante.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(guess).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? 0 : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offset = asUtc - guess.getTime();
  // A "guess" está em UTC; para representar o horário local `h:m` em `tz`,
  // precisamos subtrair esse offset (se tz é UTC+X, offset é +X ms).
  // Além disso, o "hoje" do usuário pode ser um dia diferente do UTC — usamos
  // a data local do usuário como referência.
  const localToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD
  const [y, mo, d] = localToday.split("-").map(Number);
  const asUtcAgain = Date.UTC(y, mo - 1, d, h, m, 0);
  return new Date(asUtcAgain - offset);
}

export const syncJourneyPushSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown): Input => InputSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { tz, agreements, notify, missions } = data;

    // Se o usuário desligou TUDO (texto/voz/vibração), não faz sentido push.
    // Ainda mantemos autoMic separado — push implica ao menos uma modalidade
    // ativa entre texto/voz/vibração.
    const anyChannel = notify.text || notify.voice || notify.vibrate;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const graceMs = 30_000; // margem pra não perder um slot pelo tick de 1 min

    type Row = {
      user_id: string;
      mission_id: string;
      phase: "preEnd" | "atEnd" | "preStart";
      fire_at: string;
      tz: string;
      title: string;
      body: string;
    };
    const rows: Row[] = [];

    if (anyChannel) {
      for (const mi of missions) {
        const start = parseHM(mi.scheduled_time);
        if (!start) continue;
        const endHM = mi.end_time ? parseHM(mi.end_time) : null;
        const startDate = localTodayToUtc(tz, start.h, start.m);
        // Duração default = 30 min quando end_time ausente.
        const endDate = endHM
          ? localTodayToUtc(tz, endHM.h, endHM.m)
          : new Date(startDate.getTime() + 30 * 60_000);

        const preStartAt = new Date(startDate.getTime() - agreements.preStart * 60_000);
        const preEndAt = new Date(endDate.getTime() - agreements.preEnd * 60_000);
        const atEndAt = new Date(endDate.getTime() - agreements.atEnd * 60_000);

        const commonTitle = `WiMi · ${mi.title}`;
        const push = (phase: Row["phase"], when: Date, body: string) => {
          if (when.getTime() <= now.getTime() + graceMs) return;
          rows.push({
            user_id: userId,
            mission_id: mi.id,
            phase,
            fire_at: when.toISOString(),
            tz,
            title: commonTitle,
            body,
          });
        };

        if (agreements.preStart > 0) push("preStart", preStartAt, `Vai começar em ${agreements.preStart} min. Bora?`);
        if (agreements.preEnd > 0) push("preEnd", preEndAt, `Faltam ${agreements.preEnd} min pro fim. Como está indo?`);
        push("atEnd", atEndAt, "Terminou. Quer fechar como feito ou ajustar?");
      }
    }

    // Apaga os slots futuros ainda não enviados deste usuário.
    await supabaseAdmin
      .from("journey_push_schedule")
      .delete()
      .eq("user_id", userId)
      .is("sent_at", null)
      .gte("fire_at", new Date(now.getTime() - graceMs).toISOString());

    if (rows.length > 0) {
      // upsert por (mission_id, phase, fire_at) — unique constraint.
      const { error } = await supabaseAdmin
        .from("journey_push_schedule")
        .upsert(rows, { onConflict: "mission_id,phase,fire_at" });
      if (error) throw error;
    }

    return { ok: true as const, scheduled: rows.length };
  });
