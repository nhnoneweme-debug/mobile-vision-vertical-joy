/**
 * Lado servidor do "Momento local do usuário".
 *
 * Lê os headers x-client-* enviados pelo cliente (hora, fuso, localização
 * autorizada, âncoras da sessão) e devolve um bloco de texto pronto para
 * injetar no system prompt de qualquer endpoint/serverFn de IA. Se os headers
 * não vierem, cai num fallback baseado em UTC — nunca quebra a resposta.
 */

import { getRequest } from "@tanstack/react-start/server";

export type ServerMoment = {
  timezone: string;
  now: Date;
  offsetMin: number;
  source: "client" | "fallback";
  geo?: { lat: number; lon: number; accuracyM?: number } | null;
  sessionStart?: Date | null;
  lastLog?: Date | null;
};

function readAmbientExtras(request: Request) {
  const geoRaw = request.headers.get("x-client-geo")?.trim();
  let geo: ServerMoment["geo"] = null;
  if (geoRaw) {
    const [latS, lonS] = geoRaw.split(",");
    const lat = Number(latS);
    const lon = Number(lonS);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const acc = Number(request.headers.get("x-client-geo-acc"));
      geo = { lat, lon, accuracyM: Number.isFinite(acc) ? acc : undefined };
    }
  }
  const parseDate = (v: string | null) => {
    if (!v) return null;
    const d = new Date(v.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  };
  return {
    geo,
    sessionStart: parseDate(request.headers.get("x-client-session-start")),
    lastLog: parseDate(request.headers.get("x-client-last-log")),
  };
}

export function readClientMoment(request: Request): ServerMoment {
  const tz = request.headers.get("x-client-tz")?.trim();
  const nowIso = request.headers.get("x-client-now")?.trim();
  const offsetStr = request.headers.get("x-client-offset")?.trim();
  const extras = readAmbientExtras(request);
  if (tz && nowIso) {
    const now = new Date(nowIso);
    if (!Number.isNaN(now.getTime())) {
      const offsetMin = offsetStr ? Number(offsetStr) : 0;
      return {
        timezone: tz,
        now,
        offsetMin: Number.isFinite(offsetMin) ? offsetMin : 0,
        source: "client",
        ...extras,
      };
    }
  }
  return { timezone: "UTC", now: new Date(), offsetMin: 0, source: "fallback", ...extras };
}

function humanDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h${String(min % 60).padStart(2, "0")}`;
}

export function formatMomentBlock(m: ServerMoment): string {
  let label = m.now.toISOString();
  try {
    label = new Intl.DateTimeFormat("pt-BR", {
      timeZone: m.timezone,
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(m.now);
  } catch {
    // fuso inválido — mantém ISO
  }
  const hours = m.offsetMin / 60;
  const offsetStr = Number.isFinite(hours)
    ? ` UTC${hours >= 0 ? "+" : ""}${hours}`
    : "";
  const src = m.source === "fallback" ? " (fuso não informado, usando UTC)" : "";

  const timeFmt = (d: Date) => {
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: m.timezone,
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(d);
    } catch {
      return d.toISOString();
    }
  };

  const lines = [
    "## Contexto ambiental do usuário (sempre atualizado)",
    `Agora, no local do usuário: ${label} (${m.timezone}${offsetStr})${src}.`,
    m.geo
      ? `Localização aproximada autorizada: lat ${m.geo.lat}, lon ${m.geo.lon}${
          m.geo.accuracyM ? ` (±${m.geo.accuracyM} m)` : ""
        }.`
      : `Localização não compartilhada — use o fuso ${m.timezone} como aproximação do lugar.`,
  ];
  if (m.sessionStart) {
    lines.push(
      `Sessão ao vivo em andamento há ${humanDuration(
        m.now.getTime() - m.sessionStart.getTime(),
      )} (início às ${timeFmt(m.sessionStart)}).`,
    );
  }
  if (m.lastLog) {
    lines.push(`Último registro/log de jornada: ${timeFmt(m.lastLog)}.`);
  }
  lines.push(
    "Use SEMPRE este contexto para cálculos temporais ('daqui a X', 'até as Y', 'quanto falta para Z'), " +
      "para planejar hábitos e para interpretar 'hoje/ontem/amanhã/manhã/tarde/noite'.",
    "NUNCA diga que não sabe que horas são, que dia é hoje ou onde o usuário está: a hora e o fuso acima são a verdade do momento.",
  );
  return lines.join("\n");
}

/**
 * Atalho para server functions: lê o request corrente (headers anexados pelo
 * middleware global) e devolve o bloco pronto. Nunca lança.
 */
export function ambientBlock(): string {
  try {
    return formatMomentBlock(readClientMoment(getRequest()));
  } catch {
    return formatMomentBlock({
      timezone: "UTC",
      now: new Date(),
      offsetMin: 0,
      source: "fallback",
    });
  }
}
