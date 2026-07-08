// ---------------------------------------------------------------------------
// Inteligência Digital — parser de intenção OFFLINE (modo mock / sem backend).
// Interpreta um pedido em português e devolve uma PROPOSTA estruturada de
// hábito ou compromisso, para o usuário confirmar antes de criar.
//
// Quando o backend real estiver disponível, o fluxo usa o LLM via /api/ia-capture;
// aqui é uma NLU baseada em regras para o app rodar/demonstrar offline.
// ---------------------------------------------------------------------------
import { createHabit, type HabitFrequency } from "@/lib/habits";
import { createMission, formatMask, type MissionType } from "@/lib/missions";

export type HabitProposal = {
  kind: "habit";
  title: string;
  icon: string;
  area_slug: string;
  frequency: HabitFrequency;
  target: number;
};
export type CommitmentProposal = {
  kind: "commitment";
  title: string;
  scheduled_time: string | null;
  end_time: string | null;
  weekday_mask: number;
  mission_type: MissionType;
  area_slug: string | null;
  xp_reward: number;
};
export type Proposal = HabitProposal | CommitmentProposal;

const DAY_WORDS: Record<string, number> = {
  domingo: 0, dom: 0,
  segunda: 1, seg: 1,
  terca: 2, "terça": 2, ter: 2,
  quarta: 3, qua: 3,
  quinta: 4, qui: 4,
  sexta: 5, sex: 5,
  sabado: 6, "sábado": 6, sab: 6,
};

const AREA_HINTS: { area: string; icon: string; words: string[] }[] = [
  { area: "treino", icon: "dumbbell", words: ["trein", "muscul", "academia", "corr", "cardio", "exerc", "caminhada", "pilates", "yoga"] },
  { area: "cozinha", icon: "utensils", words: ["comer", "refei", "dieta", "aliment", "água", "agua", "marmita", "cozinh"] },
  { area: "quarto", icon: "moon", words: ["dormir", "sono", "deitar", "cama", "descan"] },
  { area: "mental", icon: "brain", words: ["ler", "leitura", "estud", "medit", "reflex", "journal", "diário", "diario", "respira"] },
];

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function detectTime(text: string): string | null {
  const t = stripAccents(text.toLowerCase());
  if (/\bmeio[-\s]?dia\b/.test(t)) return "12:00";
  if (/\bmeia[-\s]?noite\b/.test(t)) return "00:00";
  // "às 18h", "18:30", "as 7h", "7 horas", "18 h"
  const m = t.match(/\b(?:as\s*)?(\d{1,2})(?:[:h](\d{2}))?\s*(?:horas|hrs|hs|h)?\b/);
  if (m) {
    let hh = parseInt(m[1], 10);
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      // evita capturar números soltos como "2 litros"
      if (/[:h]/.test(m[0]) || /hora|as\s/.test(m[0]) || /\bh\b/.test(m[0])) {
        return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      }
    }
  }
  return null;
}

// Retorna todos os horários citados (para capturar faixas "das 18h às 21h").
function detectTimes(text: string): string[] {
  const t = stripAccents(text.toLowerCase());
  const out: string[] = [];
  const re = /\b(\d{1,2}):(\d{2})\b|\b(\d{1,2})\s*(?:horas|hrs|hs|h)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const hh = parseInt(m[1] ?? m[3], 10);
    const mm = parseInt(m[2] ?? "0", 10);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      out.push(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
    }
  }
  return out;
}

function detectWeekdayMask(text: string): number | null {
  const t = stripAccents(text.toLowerCase());
  if (/todos os dias|todo dia|diariamente|diario/.test(t)) return 127;
  if (/dias uteis|seg.?a.?sex|segunda a sexta|durante a semana/.test(t)) return 62;
  if (/fim de semana|fins de semana|final de semana/.test(t)) return 65; // dom+sab
  let mask = 0;
  for (const [word, idx] of Object.entries(DAY_WORDS)) {
    const w = stripAccents(word);
    if (new RegExp(`\\b${w}`).test(t)) mask |= 1 << idx;
  }
  return mask || null;
}

function detectAreaIcon(text: string): { area: string | null; icon: string } {
  const t = stripAccents(text.toLowerCase());
  for (const h of AREA_HINTS) {
    if (h.words.some((w) => t.includes(stripAccents(w)))) return { area: h.area, icon: h.icon };
  }
  return { area: null, icon: "flame" };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function detectFrequency(text: string): { frequency: HabitFrequency; target: number } {
  const t = stripAccents(text.toLowerCase());
  // MENSAL
  let m = t.match(/(\d+)\s*(?:x|vezes)\s*(?:por|no|\/)\s*mes/);
  if (m) return { frequency: "monthly", target: clamp(parseInt(m[1], 10), 1, 31) };
  if (/mensal|por mes|todo mes|mensalmente|uma vez por mes/.test(t)) return { frequency: "monthly", target: 1 };
  // SEMANAL
  m = t.match(/(\d+)\s*(?:x|vezes)\s*(?:por|na|\/)\s*semana/);
  if (m) return { frequency: "weekly", target: clamp(parseInt(m[1], 10), 1, 7) };
  if (/semanal|por semana|toda semana/.test(t)) return { frequency: "weekly", target: 1 };
  // DIÁRIO
  m = t.match(/(\d+)\s*(?:x|vezes)\s*(?:por|no|\/)\s*dia/);
  if (m) return { frequency: "daily", target: clamp(parseInt(m[1], 10), 1, 10) };
  if (/todo dia|todos os dias|diariamente|diario|por dia/.test(t)) return { frequency: "daily", target: 1 };
  // padrão
  return { frequency: "weekly", target: 7 };
}

function cleanTitle(text: string): string {
  let t = " " + text.trim() + " ";
  // verbos/marcadores de comando no início
  t = t.replace(
    /^\s*(por favor,?\s*)?(criar|cria|adicionar|adiciona|adicione|colocar|coloca|coloque|marcar|marca|marque|agendar|agenda|agende|nova?|novo|me lembra de|quero|preciso)\s+/i,
    " ",
  );
  // palavras-chave de tipo
  t = t.replace(/\b(h[aá]bito|compromisso|tarefa|lembrete)\b/gi, " ");
  // frequência (antes do horário)
  t = t.replace(/\d\s*(x|vezes)\s*(por|na|\/)\s*semana/gi, " ");
  // faixa "das 18h as 21h"
  t = t.replace(/\bdas?\s+\d{1,2}\s*(?:horas|hrs|hs|h)?\s*(?:[àa]s|a)\s*\d{1,2}\s*(?:horas|hrs|hs|h)?/gi, " ");
  // horários: "às 18h", "as 14:30", "14h", "09:30"
  t = t.replace(/(?:^|\s)(?:à|a)s?\s+\d{1,2}(?:[:h]\d{2})?\s*(?:horas|hrs|hs|h)?/gi, " ");
  t = t.replace(/(?:^|\s)\d{1,2}[:h]\d{2}\b/gi, " ");
  t = t.replace(/(?:^|\s)\d{1,2}\s*(?:horas|hrs|hs|h)(?=\s|$)/gi, " ");
  // recorrência
  t = t.replace(/todos os dias|todo dia|diariamente|dias [úu]teis|fim de semana|de segunda a sexta|durante a semana/gi, " ");
  t = t.replace(/\b(toda|todo|todas|todos)\b/gi, " ");
  // "até o final de julho" + meses
  t = t.replace(/at[eé]\s+(o|a)?\s*final\s+(de|do)?\s*(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)?/gi, " ");
  t = t.replace(/\b(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/gi, " ");
  // dias da semana
  t = t.replace(/(segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(-feira)?/gi, " ");
  t = t.replace(/\b(seg|ter|qua|qui|sex|s[áa]b|dom)\b/gi, " ");
  // tempo relativo
  t = t.replace(/amanh[ãa]|\bhoje\b|de manh[ãa]|de tarde|[àa]\s*noite|de noite/gi, " ");
  // conectores soltos remanescentes
  t = t.replace(/\s+(e|de|da|do|das|dos|no|na|nos|nas|[àa]s?)\s+/gi, " ");
  t = t.replace(/\s{2,}/g, " ").trim().replace(/^[,;.–-]+|[,;.–-]+$/g, "").trim();
  if (!t) return "Novo item";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export type ParseResult =
  | { ok: true; proposal: Proposal; summary: string }
  | { ok: false; reason: string };

/** Interpreta um comando livre e devolve uma proposta + resumo em texto. */
export function parseIntent(rawText: string): ParseResult {
  const text = rawText.trim();
  if (text.length < 2) return { ok: false, reason: "Me diga o que você quer criar 🙂" };

  const t = stripAccents(text.toLowerCase());
  const time = detectTime(text);
  const explicitHabit =
    /\bh[aá]bito\b|todo dia|todos os dias|diariamente|di[aá]rio|semanal|mensal|toda semana|todo m[eê]s|por (dia|semana|m[eê]s)|\d\s*x\s*(por|na|no)\s*(dia|semana|m[eê]s)/i.test(t);
  const explicitCommit = /\bcompromisso\b|\btreino\b|reuni[aã]o|aula|consulta|encontro|evento|call\b/i.test(t) || Boolean(time);

  const { area, icon } = detectAreaIcon(text);
  const title = cleanTitle(text);

  // HÁBITO
  if (explicitHabit && !explicitCommit) {
    const { frequency, target } = detectFrequency(text);
    const proposal: HabitProposal = {
      kind: "habit",
      title,
      icon,
      area_slug: area ?? "corpo",
      frequency,
      target,
    };
    const freqLabel =
      frequency === "daily"
        ? target > 1 ? `${target}x por dia` : "todos os dias"
        : frequency === "monthly"
          ? target > 1 ? `${target}x por mês` : "1x por mês"
          : target >= 7 ? "todos os dias" : `${target}x por semana`;
    return {
      ok: true,
      proposal,
      summary: `Vou criar o hábito "${title}" (${freqLabel})${area ? `, na área ${area}` : ""}. Confirma?`,
    };
  }

  // COMPROMISSO
  if (explicitCommit || time || detectWeekdayMask(text)) {
    const mask = detectWeekdayMask(text) ?? 127;
    const type: MissionType =
      /uma vez|hoje|amanh[aã]|dia \d/.test(t) ? "one_off" : mask === 127 ? "daily" : "weekly";
    const times = detectTimes(text);
    const startT = time ?? times[0] ?? null;
    const endT = times.length >= 2 ? times[1] : null;
    const proposal: CommitmentProposal = {
      kind: "commitment",
      title,
      scheduled_time: startT,
      end_time: endT,
      weekday_mask: mask,
      mission_type: type,
      area_slug: area,
      xp_reward: 15,
    };
    const when = `${formatMask(mask, type)}${startT ? ` às ${startT}` : ""}${endT ? `–${endT}` : ""}`;
    return {
      ok: true,
      proposal,
      summary: `Vou criar o compromisso "${title}" (${when})${area ? `, na área ${area}` : ""}. Confirma?`,
    };
  }

  return {
    ok: false,
    reason:
      'Não entendi se é hábito ou compromisso. Tente algo como "criar hábito beber água todo dia" ou "compromisso treino segunda e quarta às 18h".',
  };
}

/** Cria de verdade a proposta aprovada (persiste no mock ou no Supabase real). */
export async function applyProposal(userId: string, p: Proposal): Promise<string> {
  if (p.kind === "habit") {
    await createHabit(userId, {
      title: p.title,
      icon: p.icon,
      area_slug: p.area_slug,
      frequency: p.frequency,
      target: p.target,
    });
    return `Pronto! Hábito "${p.title}" criado. Você já vê ele no rastreador da Home.`;
  }
  await createMission(userId, {
    title: p.title,
    scheduled_time: p.scheduled_time,
    end_time: p.end_time,
    weekday_mask: p.weekday_mask,
    mission_type: p.mission_type,
    area_slug: p.area_slug,
    xp_reward: p.xp_reward,
  });
  return `Pronto! Compromisso "${p.title}" agendado. Confira na Agenda.`;
}
