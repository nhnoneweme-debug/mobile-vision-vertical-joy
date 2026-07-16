import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const APP_ORIGIN = process.env.APP_ORIGIN || "http://localhost:3000";
const REDIRECT_URI = `${APP_ORIGIN}/api/google-calendar-callback`;
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPES = "https://www.googleapis.com/auth/calendar.events openid email profile";

export const getGoogleCalendarAuthUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!GOOGLE_CLIENT_ID) {
      throw new Error("GOOGLE_CLIENT_ID não configurado");
    }
    const state = Buffer.from(JSON.stringify({ userId: context.userId, ts: Date.now() })).toString(
      "base64url",
    );
    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return { url: url.toString() };
  });

export const exchangeGoogleCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("Google OAuth não configurado");
    }
    const db = context.supabase as Db;
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: data.code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Falha ao trocar código: ${err}`);
    }
    const tokens = await tokenRes.json();
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
    await db.from("google_calendar_connections").upsert(
      {
        user_id: context.userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: expiresAt,
        calendar_id: "primary",
        sync_enabled: true,
      },
      { onConflict: "user_id" },
    );
    return { ok: true };
  });

export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as Db;
    await db.from("google_calendar_connections").delete().eq("user_id", context.userId);
    await db.from("google_calendar_event_map").delete().eq("user_id", context.userId);
    return { ok: true };
  });

export const getGoogleCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as Db;
    const { data } = await db
      .from("google_calendar_connections")
      .select("calendar_id, sync_enabled, last_synced_at, token_expires_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return { connected: false };
    return {
      connected: true,
      sync_enabled: data.sync_enabled,
      last_synced_at: data.last_synced_at,
      expires_at: data.token_expires_at,
    };
  });

async function ensureAccessToken(db: Db, userId: string): Promise<string> {
  const { data: conn } = await db
    .from("google_calendar_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!conn) throw new Error("Google Calendar não conectado");
  const expiresMs = new Date(conn.token_expires_at).getTime();
  if (expiresMs - Date.now() > 5 * 60_000) return conn.access_token;
  if (!conn.refresh_token || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Token expirado e sem refresh_token");
  }
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Refresh falhou");
  const tokens = await res.json();
  const newExpiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
  await db
    .from("google_calendar_connections")
    .update({
      access_token: tokens.access_token,
      token_expires_at: newExpiry,
      ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
    })
    .eq("user_id", userId);
  return tokens.access_token;
}

export const syncMissionsToCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as Db;
    const token = await ensureAccessToken(db, context.userId);

    // Fuso real da pessoa — mandar tudo como São Paulo joga o treino de quem
    // mora em outro fuso na hora errada do Google Calendar.
    const { data: prefs } = await db
      .from("notification_prefs")
      .select("timezone")
      .eq("user_id", context.userId)
      .maybeSingle();
    const timeZone = prefs?.timezone || "America/Sao_Paulo";

    // Compromissos, lembretes e treinos são todos user_missions — o que a
    // pessoa agenda na Agenda (inclusive "Treino de força") cai aqui.
    const { data: missions } = await db
      .from("user_missions")
      .select("id, title, notes, scheduled_time, end_time, weekday_mask, mission_type, active")
      .eq("user_id", context.userId)
      .eq("active", true);
    if (!missions?.length) {
      await db
        .from("google_calendar_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("user_id", context.userId);
      return { synced: 0 };
    }

    const { data: map } = await db
      .from("google_calendar_event_map")
      .select("mission_id, google_event_id")
      .eq("user_id", context.userId);
    const eventMap = new Map<string, string>(
      ((map ?? []) as Array<{ mission_id: string; google_event_id: string }>).map((m) => [
        m.mission_id,
        m.google_event_id,
      ]),
    );

    let synced = 0;
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

    for (const mission of missions as Array<{
      id: string;
      title: string;
      notes: string | null;
      scheduled_time: string | null;
      end_time: string | null;
      weekday_mask: number;
      mission_type: string;
    }>) {
      const existingEventId = eventMap.get(mission.id);

      const startTime = mission.scheduled_time || "09:00:00";
      const endTime = mission.end_time || startTime;
      const todayStr = today.toISOString().slice(0, 10);

      const byDay: string[] = [];
      for (let d = 0; d < 7; d++) {
        if (mission.weekday_mask & (1 << d)) byDay.push(dayNames[d]);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event: any = {
        summary: mission.title,
        description: mission.notes || "",
        start: { dateTime: `${todayStr}T${startTime}`, timeZone },
        end: { dateTime: `${todayStr}T${endTime}`, timeZone },
      };

      if (mission.mission_type === "daily" || (mission.mission_type === "weekly" && byDay.length)) {
        event.recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${byDay.join(",")};COUNT=52`];
      }

      // Já sincronizado: atualiza em vez de pular, senão renomear/reagendar o
      // compromisso aqui deixava o evento velho pra sempre no Google.
      const res = existingEventId
        ? await fetch(
            `${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(existingEventId)}`,
            {
              method: "PATCH",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify(event),
            },
          )
        : await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(event),
          });

      if (res.ok) {
        if (!existingEventId) {
          const created = await res.json();
          await db.from("google_calendar_event_map").insert({
            user_id: context.userId,
            mission_id: mission.id,
            google_event_id: created.id,
          });
        }
        synced++;
      } else if (existingEventId && (res.status === 404 || res.status === 410)) {
        // Apagado no Google: esquece o vínculo pra recriar no próximo sync.
        await db
          .from("google_calendar_event_map")
          .delete()
          .eq("user_id", context.userId)
          .eq("mission_id", mission.id);
      }
    }

    await db
      .from("google_calendar_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    return { synced };
  });

export const toggleCalendarSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as Db;
    await db
      .from("google_calendar_connections")
      .update({ sync_enabled: data.enabled })
      .eq("user_id", context.userId);
    return { ok: true };
  });
