/**
 * Lado servidor do "Momento local do usuário".
 *
 * Lê os headers x-client-tz / x-client-now / x-client-offset enviados pelo
 * cliente e devolve um bloco de texto pronto para injetar no system prompt
 * de qualquer endpoint de IA. Se os headers não vierem (ex.: chamada
 * antiga), cai num fallback baseado em UTC — nunca quebra a resposta.
 */

export type ServerMoment = {
  timezone: string;
  now: Date;
  offsetMin: number;
  source: "client" | "fallback";
};

export function readClientMoment(request: Request): ServerMoment {
  const tz = request.headers.get("x-client-tz")?.trim();
  const nowIso = request.headers.get("x-client-now")?.trim();
  const offsetStr = request.headers.get("x-client-offset")?.trim();
  if (tz && nowIso) {
    const now = new Date(nowIso);
    if (!Number.isNaN(now.getTime())) {
      const offsetMin = offsetStr ? Number(offsetStr) : 0;
      return {
        timezone: tz,
        now,
        offsetMin: Number.isFinite(offsetMin) ? offsetMin : 0,
        source: "client",
      };
    }
  }
  return { timezone: "UTC", now: new Date(), offsetMin: 0, source: "fallback" };
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
  return [
    "## Momento agora do usuário",
    `Agora, no local do usuário: ${label} (${m.timezone}${offsetStr})${src}.`,
    "Use SEMPRE este horário como referência temporal ao planejar hábitos, sugerir próximos passos e interpretar 'hoje/ontem/amanhã/manhã/tarde/noite'.",
  ].join("\n");
}
