/**
 * Momento local do usuário — capturado no cliente (fuso + hora agora) e
 * repassado ao backend via headers em cada request de IA. Serve como âncora
 * temporal para o modelo (planejar hábitos, entender "hoje/ontem/amanhã",
 * distinguir manhã/tarde/noite) e como faixa de auditoria no /assistente.
 *
 * Fuso é lido sem precisar de permissão (Intl.DateTimeFormat). Geolocalização
 * fica para um passo futuro — o horário local já basta para o planejamento.
 */

export type ClientMoment = {
  timezone: string;
  now_iso: string;
  offset_min: number;
  locale?: string;
};

export function getClientMoment(): ClientMoment {
  const tz =
    (typeof Intl !== "undefined" &&
      Intl.DateTimeFormat().resolvedOptions().timeZone) ||
    "UTC";
  const d = new Date();
  return {
    timezone: tz,
    now_iso: d.toISOString(),
    offset_min: -d.getTimezoneOffset(),
    locale: typeof navigator !== "undefined" ? navigator.language : undefined,
  };
}

/** Headers a serem mesclados em qualquer fetch/transport de IA. */
export function clientMomentHeaders(): Record<string, string> {
  const m = getClientMoment();
  return {
    "x-client-tz": m.timezone,
    "x-client-now": m.now_iso,
    "x-client-offset": String(m.offset_min),
    ...(m.locale ? { "x-client-locale": m.locale } : {}),
  };
}

/** Rótulo humano curto — usado no chip de auditoria do /assistente. */
export function formatMomentLabel(m: ClientMoment = getClientMoment()): string {
  try {
    const now = new Date(m.now_iso);
    const fmt = new Intl.DateTimeFormat("pt-BR", {
      timeZone: m.timezone,
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${fmt.format(now)} · ${m.timezone}`;
  } catch {
    return m.timezone;
  }
}
