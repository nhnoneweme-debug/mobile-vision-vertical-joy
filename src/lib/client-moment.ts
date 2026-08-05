/**
 * Momento local do usuário — capturado no cliente (fuso + hora agora) e
 * repassado ao backend via headers em cada request de IA. Serve como âncora
 * temporal para o modelo (planejar hábitos, entender "hoje/ontem/amanhã",
 * distinguir manhã/tarde/noite) e como faixa de auditoria no /assistente.
 *
 * Camada 3.9.4: além de hora e fuso, o bloco ambiental leva localização
 * aproximada (só quando autorizada), tempo decorrido da sessão Live e horário
 * do último registro. Nada disso bloqueia a conversa: faltando qualquer peça,
 * o fuso vale como aproximação.
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

// ------------------------------------------------------------ LOCALIZAÇÃO
// Permissão pedida UMA vez, com explicação na UI. Preferência e última
// coordenada aproximada ficam no localStorage; negado = seguimos pelo fuso.

const GEO_KEY = "wimi.ambient.geo.v1";

export type GeoPref = {
  status: "unknown" | "granted" | "denied";
  lat?: number;
  lon?: number;
  accuracy_m?: number;
  at?: string;
};

export function loadGeoPref(): GeoPref {
  try {
    const raw = localStorage.getItem(GEO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GeoPref;
      if (parsed && typeof parsed.status === "string") return parsed;
    }
  } catch {
    /* storage opcional */
  }
  return { status: "unknown" };
}

function saveGeoPref(pref: GeoPref) {
  try {
    localStorage.setItem(GEO_KEY, JSON.stringify(pref));
  } catch {
    /* storage opcional */
  }
}

/** Pede a permissão (uma vez) e guarda a última posição aproximada. */
export async function requestClientLocation(): Promise<GeoPref> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    const pref: GeoPref = { status: "denied" };
    saveGeoPref(pref);
    return pref;
  }
  return new Promise<GeoPref>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pref: GeoPref = {
          status: "granted",
          // 2 casas ≈ 1 km: contexto suficiente, sem precisão desnecessária.
          lat: Math.round(pos.coords.latitude * 100) / 100,
          lon: Math.round(pos.coords.longitude * 100) / 100,
          accuracy_m: Math.round(pos.coords.accuracy),
          at: new Date().toISOString(),
        };
        saveGeoPref(pref);
        resolve(pref);
      },
      () => {
        const pref: GeoPref = { status: "denied" };
        saveGeoPref(pref);
        resolve(pref);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

/** Esquece a localização compartilhada (volta ao fuso como aproximação). */
export function clearClientLocation() {
  saveGeoPref({ status: "denied" });
}

// ----------------------------------------------------- ÂNCORAS DA SESSÃO
// Painéis vivos (Live/Executando) registram aqui o início da sessão e o
// horário do último registro — vira contexto de TODA chamada de IA.

let sessionStartMs: number | null = null;
let lastLogIso: string | null = null;

export function setAmbientSessionStart(ts: number | null) {
  sessionStartMs = ts;
}

export function setAmbientLastLog(iso: string | null) {
  lastLogIso = iso;
}

/** Headers a serem mesclados em qualquer fetch/transport de IA. */
export function clientMomentHeaders(): Record<string, string> {
  const m = getClientMoment();
  const geo = loadGeoPref();
  const h: Record<string, string> = {
    "x-client-tz": m.timezone,
    "x-client-now": m.now_iso,
    "x-client-offset": String(m.offset_min),
    ...(m.locale ? { "x-client-locale": m.locale } : {}),
  };
  if (geo.status === "granted" && typeof geo.lat === "number" && typeof geo.lon === "number") {
    h["x-client-geo"] = `${geo.lat},${geo.lon}`;
    if (geo.accuracy_m) h["x-client-geo-acc"] = String(geo.accuracy_m);
  }
  if (sessionStartMs) h["x-client-session-start"] = new Date(sessionStartMs).toISOString();
  if (lastLogIso) h["x-client-last-log"] = lastLogIso;
  return h;
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

/** Linha de transparência: o que exatamente vai junto de cada mensagem. */
export function describeSharedContext(): string {
  const m = getClientMoment();
  const geo = loadGeoPref();
  const parts = [`hora local e fuso (${m.timezone})`];
  parts.push(
    geo.status === "granted" && typeof geo.lat === "number"
      ? `localização aproximada (~${geo.lat}, ${geo.lon})`
      : "localização não compartilhada (usamos só o fuso)",
  );
  if (sessionStartMs) parts.push("tempo de sessão");
  if (lastLogIso) parts.push("horário do último registro");
  return parts.join(" · ");
}
