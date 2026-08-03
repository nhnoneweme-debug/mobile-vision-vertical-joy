// STUDIO DE PERSONAS (Camada 3.8) — o usuário define COMO Wi e Mi se manifestam.
//
// O modelo é um bloco EXPORTÁVEL: JSON versionado com intuito legível, que pode
// ser baixado, compartilhado e importado em outra conta (arquitetura social).
// O critério fixo da camada anterior vira o preset padrão "Equilíbrio".

import { supabase } from "@/integrations/supabase/client";
import { PERSONA_DEFAULT_SERVER_VOICE, type Persona, type PersonaChoice } from "@/lib/personas";

export const PERSONA_SCHEMA_VERSION = 1;

export type PersonaSpec = {
  /** nome exibido da identidade (padrão "Wi" / "Mi") */
  label: string;
  /** papel: tutora / mentor */
  role: string;
  /** tom desejado em uma frase */
  tone: string;
  /** timbre do TTS de servidor */
  server_voice: string;
  /** voz do aparelho (opcional, por voiceURI) */
  device_voice_uri?: string | null;
  /** instruções de comportamento em texto livre */
  instructions: string;
};

export type RoutingRules = {
  /** predominância de Wi (0 = só Mi, 100 = só Wi) */
  wi_share: number;
  /** o quanto: intensidade das manifestações */
  intensity: "leve" | "media" | "forte";
  /** onde: superfícies em que as personas se manifestam */
  surfaces: { live_chat: boolean; rituals: boolean; triggers: boolean };
  /** como: extensão e postura */
  style: { length: "curta" | "media" | "longa"; approach: "direto" | "acolhedor" | "equilibrado" };
  /** quando: contexto → identidade */
  contexts: { context: string; persona: PersonaChoice }[];
  /** regras extras em texto livre */
  notes: string;
};

export type PersonaModel = {
  schema_version: number;
  name: string;
  intent: string;
  wi: PersonaSpec;
  mi: PersonaSpec;
  routing: RoutingRules;
};

export type PersonaProfile = PersonaModel & {
  id: string;
  is_active: boolean;
  updated_at: string;
};

// ------------------------------------------------------------- presets

function spec(persona: Persona, over: Partial<PersonaSpec> = {}): PersonaSpec {
  const base: PersonaSpec =
    persona === "wi"
      ? {
          label: "Wi",
          role: "tutora",
          tone: "acolhedora, próxima e prática",
          server_voice: PERSONA_DEFAULT_SERVER_VOICE.wi,
          device_voice_uri: null,
          instructions:
            "Acompanha o dia a dia, explica com clareza, incentiva sem bajular e faz perguntas curtas de log de jornada.",
        }
      : {
          label: "Mi",
          role: "mentor",
          tone: "direto, sóbrio e honesto",
          server_voice: PERSONA_DEFAULT_SERVER_VOICE.mi,
          device_voice_uri: null,
          instructions:
            "Ajuda a decidir, revisa criticamente o que foi registrado e confronta com honestidade, sem dureza gratuita.",
        };
  return { ...base, ...over };
}

function routing(over: Partial<RoutingRules> = {}): RoutingRules {
  return {
    wi_share: 50,
    intensity: "media",
    surfaces: { live_chat: true, rituals: true, triggers: true },
    style: { length: "curta", approach: "equilibrado" },
    contexts: [
      { context: "acompanhamento do dia a dia, dúvidas práticas e incentivo", persona: "wi" },
      { context: "decisão, estratégia, revisão crítica e avaliação de progresso", persona: "mi" },
    ],
    notes: "",
    ...over,
  };
}

export type PersonaPreset = { key: string; title: string; description: string; model: PersonaModel };

export const PERSONA_PRESETS: PersonaPreset[] = [
  {
    key: "equilibrio",
    title: "Equilíbrio",
    description:
      "Preset padrão: Wi no acompanhamento diário, Mi na revisão e decisão. Intensidade média, respostas curtas, em todas as superfícies.",
    model: {
      schema_version: PERSONA_SCHEMA_VERSION,
      name: "Equilíbrio",
      intent: "Par equilibrado: tutora no cotidiano, mentor nas decisões.",
      wi: spec("wi"),
      mi: spec("mi"),
      routing: routing(),
    },
  },
  {
    key: "acolhimento",
    title: "Acompanhamento acolhedor",
    description:
      "Predominância Wi (80%): presença constante, tom acolhedor, respostas médias. Mi só aparece em avaliação de progresso.",
    model: {
      schema_version: PERSONA_SCHEMA_VERSION,
      name: "Acompanhamento acolhedor",
      intent: "Rotina de apoio: presença frequente, linguagem gentil, pouco confronto.",
      wi: spec("wi", { tone: "muito acolhedora, calorosa e paciente" }),
      mi: spec("mi", { tone: "firme, mas curto e raro" }),
      routing: routing({
        wi_share: 80,
        intensity: "forte",
        style: { length: "media", approach: "acolhedor" },
        contexts: [
          { context: "qualquer acompanhamento, dúvida ou registro do dia", persona: "wi" },
          { context: "somente avaliação formal de progresso", persona: "mi" },
        ],
        notes: "Evite confronto direto durante a execução; guarde a crítica para o fechamento do dia.",
      }),
    },
  },
  {
    key: "revisao",
    title: "Revisão de progresso",
    description:
      "Predominância Mi (75%): confronto honesto com o registrado, respostas curtas e diretas, foco em decisão.",
    model: {
      schema_version: PERSONA_SCHEMA_VERSION,
      name: "Revisão de progresso",
      intent: "Ciclo de auditoria: cobrar o combinado e forçar decisões.",
      wi: spec("wi", { tone: "objetiva, breve, sem floreio" }),
      mi: spec("mi", { tone: "muito direto, cirúrgico, sem rodeios" }),
      routing: routing({
        wi_share: 25,
        intensity: "forte",
        style: { length: "curta", approach: "direto" },
        contexts: [
          { context: "revisão, decisão, avaliação e confronto com o registrado", persona: "mi" },
          { context: "instrução prática pontual", persona: "wi" },
        ],
        notes: "Sempre compare o que foi dito antes com o que foi executado.",
      }),
    },
  },
];

export function defaultPersonaModel(): PersonaModel {
  return structuredClone(PERSONA_PRESETS[0]!.model);
}

// ------------------------------------------------- diretiva para o prompt

const INTENSITY_TEXT: Record<RoutingRules["intensity"], string> = {
  leve: "manifeste-se pouco, só quando agregar",
  media: "manifeste-se com equilíbrio",
  forte: "manifeste-se com presença marcante",
};

const LENGTH_TEXT: Record<RoutingRules["style"]["length"], string> = {
  curta: "até 2 frases",
  media: "até 4 frases",
  longa: "até 8 frases",
};

const APPROACH_TEXT: Record<RoutingRules["style"]["approach"], string> = {
  direto: "postura direta",
  acolhedor: "postura acolhedora",
  equilibrado: "postura equilibrada",
};

/** Converte o modelo salvo em instruções de sistema para as manifestações. */
export function buildPersonaDirective(model: PersonaModel): string {
  const r = model.routing;
  const contexts = r.contexts
    .filter((c) => c.context.trim())
    .map((c) => `• ${c.context} → ${c.persona === "auto" ? "o modelo decide" : c.persona}`)
    .join("\n");
  const surfaces = Object.entries(r.surfaces)
    .filter(([, on]) => on)
    .map(([k]) => ({ live_chat: "chat do ouvido", rituals: "rituais", triggers: "gatilhos" })[k])
    .join(", ");
  return [
    `MODELO DE PERSONAS ATIVO: "${model.name}"${model.intent ? ` — ${model.intent}` : ""}.`,
    `${model.wi.label} (${model.wi.role}): tom ${model.wi.tone}. ${model.wi.instructions}`,
    `${model.mi.label} (${model.mi.role}): tom ${model.mi.tone}. ${model.mi.instructions}`,
    `PROPORÇÃO ALVO: ~${r.wi_share}% das respostas por ${model.wi.label}, ~${100 - r.wi_share}% por ${model.mi.label}.`,
    contexts ? `ROTEAMENTO POR CONTEXTO:\n${contexts}` : "",
    `INTENSIDADE: ${INTENSITY_TEXT[r.intensity]}. FORMA: ${LENGTH_TEXT[r.style.length]}, ${APPROACH_TEXT[r.style.approach]}.`,
    surfaces ? `SUPERFÍCIES ATIVAS: ${surfaces}.` : "",
    r.notes ? `REGRAS EXTRAS: ${r.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2500);
}

// ------------------------------------------------------------ validação

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function parseSpec(raw: unknown, persona: Persona): PersonaSpec {
  const base = spec(persona);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  return {
    label: asString(o["label"], base.label).slice(0, 40),
    role: asString(o["role"], base.role).slice(0, 60),
    tone: asString(o["tone"], base.tone).slice(0, 200),
    server_voice: asString(o["server_voice"], base.server_voice).slice(0, 40),
    device_voice_uri: typeof o["device_voice_uri"] === "string" ? o["device_voice_uri"] : null,
    instructions: asString(o["instructions"], base.instructions).slice(0, 2000),
  };
}

function parseRouting(raw: unknown): RoutingRules {
  const base = routing();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const share = Number(o["wi_share"]);
  const surfaces = (o["surfaces"] ?? {}) as Record<string, unknown>;
  const style = (o["style"] ?? {}) as Record<string, unknown>;
  const contexts = Array.isArray(o["contexts"])
    ? (o["contexts"] as unknown[])
        .map((c) => {
          const co = (c ?? {}) as Record<string, unknown>;
          const p = co["persona"];
          return {
            context: asString(co["context"], "").slice(0, 200),
            persona: (p === "wi" || p === "mi" || p === "auto" ? p : "auto") as PersonaChoice,
          };
        })
        .filter((c) => c.context)
        .slice(0, 12)
    : base.contexts;
  return {
    wi_share: Number.isFinite(share) ? Math.min(100, Math.max(0, Math.round(share))) : base.wi_share,
    intensity:
      o["intensity"] === "leve" || o["intensity"] === "forte"
        ? (o["intensity"] as RoutingRules["intensity"])
        : "media",
    surfaces: {
      live_chat: surfaces["live_chat"] !== false,
      rituals: surfaces["rituals"] !== false,
      triggers: surfaces["triggers"] !== false,
    },
    style: {
      length:
        style["length"] === "media" || style["length"] === "longa"
          ? (style["length"] as RoutingRules["style"]["length"])
          : "curta",
      approach:
        style["approach"] === "direto" || style["approach"] === "acolhedor"
          ? (style["approach"] as RoutingRules["style"]["approach"])
          : "equilibrado",
    },
    contexts: contexts.length ? contexts : base.contexts,
    notes: asString(o["notes"], "").slice(0, 1000),
  };
}

/** Valida um arquivo importado. Lança erro legível quando o schema não bate. */
export function parsePersonaModel(raw: unknown): PersonaModel {
  if (!raw || typeof raw !== "object") throw new Error("Arquivo inválido: não é um objeto JSON.");
  const o = raw as Record<string, unknown>;
  const version = Number(o["schema_version"]);
  if (!Number.isFinite(version) || version < 1)
    throw new Error("Arquivo inválido: falta 'schema_version'.");
  if (version > PERSONA_SCHEMA_VERSION)
    throw new Error(
      `Arquivo na versão ${version}; este app entende até a ${PERSONA_SCHEMA_VERSION}.`,
    );
  const name = asString(o["name"], "").trim();
  if (!name) throw new Error("Arquivo inválido: falta o nome do modelo.");
  return {
    schema_version: PERSONA_SCHEMA_VERSION,
    name: name.slice(0, 80),
    intent: asString(o["intent"], "").slice(0, 500),
    wi: parseSpec(o["wi"], "wi"),
    mi: parseSpec(o["mi"], "mi"),
    routing: parseRouting(o["routing"]),
  };
}

export function personaModelToFile(model: PersonaModel): string {
  return JSON.stringify(
    {
      schema_version: PERSONA_SCHEMA_VERSION,
      kind: "wimi.persona_model",
      exported_at: new Date().toISOString(),
      name: model.name,
      intent: model.intent,
      wi: model.wi,
      mi: model.mi,
      routing: model.routing,
    },
    null,
    2,
  );
}

export function downloadPersonaModel(model: PersonaModel): void {
  const blob = new Blob([personaModelToFile(model)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wimi-personas-${model.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --------------------------------------------------------- persistência

type Row = {
  id: string;
  name: string;
  intent: string | null;
  schema_version: number;
  is_active: boolean;
  wi: unknown;
  mi: unknown;
  routing: unknown;
  updated_at: string;
};

function rowToProfile(row: Row): PersonaProfile {
  return {
    id: row.id,
    is_active: row.is_active,
    updated_at: row.updated_at,
    schema_version: row.schema_version,
    name: row.name,
    intent: row.intent ?? "",
    wi: parseSpec(row.wi, "wi"),
    mi: parseSpec(row.mi, "mi"),
    routing: parseRouting(row.routing),
  };
}

export async function listPersonaProfiles(): Promise<PersonaProfile[]> {
  const { data, error } = await supabase
    .from("persona_profiles")
    .select("id, name, intent, schema_version, is_active, wi, mi, routing, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(rowToProfile);
}

export async function getActivePersonaModel(): Promise<PersonaProfile | null> {
  const { data, error } = await supabase
    .from("persona_profiles")
    .select("id, name, intent, schema_version, is_active, wi, mi, routing, updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data as unknown as Row) : null;
}

export async function savePersonaProfile(
  model: PersonaModel,
  id?: string | null,
): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado.");
  const payload = {
    user_id: u.user.id,
    name: model.name,
    intent: model.intent,
    schema_version: PERSONA_SCHEMA_VERSION,
    wi: model.wi as never,
    mi: model.mi as never,
    routing: model.routing as never,
  };
  if (id) {
    const { error } = await supabase.from("persona_profiles").update(payload).eq("id", id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase
    .from("persona_profiles")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function activatePersonaProfile(id: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado.");
  const off = await supabase
    .from("persona_profiles")
    .update({ is_active: false })
    .eq("user_id", u.user.id)
    .eq("is_active", true);
  if (off.error) throw off.error;
  const { error } = await supabase
    .from("persona_profiles")
    .update({ is_active: true })
    .eq("id", id);
  if (error) throw error;
}

export async function deletePersonaProfile(id: string): Promise<void> {
  const { error } = await supabase.from("persona_profiles").delete().eq("id", id);
  if (error) throw error;
}
