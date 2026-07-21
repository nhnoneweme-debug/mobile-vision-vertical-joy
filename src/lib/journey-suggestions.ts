// Sugestões dinâmicas de ação para cada manifestação da WiMi.
//
// A regra: 3 botões por manifestação, escolhidos com base no tipo de bloco
// (area_slug) e na fase do gatilho (preEnd | atEnd | preStart). O pool é
// maior que 3 e a ordem é definida por: (peso das escolhas passadas do
// usuário, guardado em journey-agreements) → ordem do pool.

import { choiceWeight, type JourneyPhase } from "./journey-agreements";

export type JourneyActionId =
  | "done"
  | "extend"
  | "skip"
  | "log_note"
  | "start_rest"
  | "rest_done"
  | "rest_more"
  | "start_now"
  | "reschedule"
  | "check_in"
  | "focus_next"
  | "ready";

export type JourneySuggestion = {
  id: JourneyActionId;
  label: string;
  intent: "primary" | "secondary" | "ghost";
};

// Pool por (área × fase). O primeiro elemento é o "peso de base" caso não haja
// histórico. area default = "geral".
const POOL: Record<string, Record<JourneyPhase, JourneySuggestion[]>> = {
  geral: {
    preEnd: [
      { id: "done", label: "Vou fechar bem", intent: "primary" },
      { id: "extend", label: "+5 min", intent: "secondary" },
      { id: "check_in", label: "Preciso de ajuda", intent: "ghost" },
      { id: "skip", label: "Não vou terminar", intent: "ghost" },
    ],
    atEnd: [
      { id: "done", label: "Feito", intent: "primary" },
      { id: "extend", label: "Estender +5", intent: "secondary" },
      { id: "skip", label: "Não rolou", intent: "ghost" },
      { id: "log_note", label: "Registrar nota", intent: "ghost" },
    ],
    preStart: [
      { id: "ready", label: "Bora, tô pronto", intent: "primary" },
      { id: "start_now", label: "Começar agora", intent: "secondary" },
      { id: "reschedule", label: "Adiar 10 min", intent: "ghost" },
      { id: "focus_next", label: "Me lembra o plano", intent: "ghost" },
    ],
    atStart: [
      { id: "start_now", label: "Iniciar agora", intent: "primary" },
      { id: "reschedule", label: "Adiar 10 min", intent: "secondary" },
      { id: "skip", label: "Pular hoje", intent: "ghost" },
    ],
  },
  treino: {
    preEnd: [
      { id: "done", label: "Última série", intent: "primary" },
      { id: "extend", label: "+5 min", intent: "secondary" },
      { id: "check_in", label: "Tá pesado", intent: "ghost" },
      { id: "skip", label: "Parar agora", intent: "ghost" },
    ],
    atEnd: [
      { id: "done", label: "Treino feito", intent: "primary" },
      { id: "log_note", label: "Registrar carga", intent: "secondary" },
      { id: "extend", label: "Mais 1 exercício", intent: "ghost" },
      { id: "skip", label: "Parei antes", intent: "ghost" },
    ],
    preStart: [
      { id: "ready", label: "Tô no ginásio", intent: "primary" },
      { id: "start_now", label: "Aquecer agora", intent: "secondary" },
      { id: "reschedule", label: "Adiar 15 min", intent: "ghost" },
    ],
    atStart: [
      { id: "start_now", label: "Puxar ferro", intent: "primary" },
      { id: "reschedule", label: "Adiar 15 min", intent: "secondary" },
      { id: "skip", label: "Hoje não", intent: "ghost" },
    ],
  },
  cozinha: {
    preEnd: [
      { id: "done", label: "Terminando de comer", intent: "primary" },
      { id: "extend", label: "+10 min", intent: "secondary" },
      { id: "log_note", label: "Anotar o que comi", intent: "ghost" },
    ],
    atEnd: [
      { id: "log_note", label: "Registrar refeição", intent: "primary" },
      { id: "done", label: "Comi tudo", intent: "secondary" },
      { id: "skip", label: "Pulei", intent: "ghost" },
    ],
    preStart: [
      { id: "ready", label: "Vou preparar", intent: "primary" },
      { id: "start_now", label: "Começar já", intent: "secondary" },
      { id: "reschedule", label: "Comer daqui 15", intent: "ghost" },
    ],
    atStart: [
      { id: "start_now", label: "À mesa", intent: "primary" },
      { id: "log_note", label: "Anotar refeição", intent: "secondary" },
      { id: "reschedule", label: "Comer daqui 15", intent: "ghost" },
    ],
  },
  mental: {
    preEnd: [
      { id: "done", label: "Finalizando reflexão", intent: "primary" },
      { id: "extend", label: "+5 min", intent: "secondary" },
      { id: "log_note", label: "Anotar insight", intent: "ghost" },
    ],
    atEnd: [
      { id: "log_note", label: "Registrar no diário", intent: "primary" },
      { id: "done", label: "Feito", intent: "secondary" },
      { id: "skip", label: "Deixa pra depois", intent: "ghost" },
    ],
    preStart: [
      { id: "ready", label: "Pronto pra respirar", intent: "primary" },
      { id: "start_now", label: "Começar agora", intent: "secondary" },
      { id: "reschedule", label: "Daqui 10 min", intent: "ghost" },
    ],
    atStart: [
      { id: "start_now", label: "Iniciar prática", intent: "primary" },
      { id: "log_note", label: "Anotar intenção", intent: "secondary" },
      { id: "reschedule", label: "Daqui 10 min", intent: "ghost" },
    ],
  },
  quarto: {
    preEnd: [
      { id: "start_rest", label: "Entrar em descanso", intent: "primary" },
      { id: "extend", label: "+10 min de tela", intent: "secondary" },
      { id: "check_in", label: "Ainda não deu sono", intent: "ghost" },
    ],
    atEnd: [
      { id: "rest_done", label: "Descansei", intent: "primary" },
      { id: "rest_more", label: "Preciso de +10", intent: "secondary" },
      { id: "log_note", label: "Registrar sono", intent: "ghost" },
    ],
    preStart: [
      { id: "ready", label: "Deitando agora", intent: "primary" },
      { id: "start_now", label: "Ritual de dormir", intent: "secondary" },
      { id: "reschedule", label: "Só mais 15", intent: "ghost" },
    ],
  },
  descanso: {
    preEnd: [
      { id: "rest_done", label: "Descansei bem", intent: "primary" },
      { id: "rest_more", label: "Preciso de +5", intent: "secondary" },
      { id: "focus_next", label: "Já foco no próximo", intent: "ghost" },
    ],
    atEnd: [
      { id: "focus_next", label: "Bora pro próximo", intent: "primary" },
      { id: "rest_more", label: "Estender +5", intent: "secondary" },
      { id: "log_note", label: "Registrar como foi", intent: "ghost" },
    ],
    preStart: [
      { id: "ready", label: "Pronto pra pausar", intent: "primary" },
      { id: "start_now", label: "Pausar já", intent: "secondary" },
      { id: "reschedule", label: "Daqui 5", intent: "ghost" },
    ],
  },
};

const REST_KINDS = new Set(["descanso", "pausa", "sono", "quarto"]);

function normalizeKind(area: string | null | undefined, title: string): string {
  const t = (title ?? "").toLowerCase();
  if (REST_KINDS.has((area ?? "").toLowerCase())) return "quarto";
  if (/descans|pausa|break|soneca/.test(t)) return "descanso";
  const a = (area ?? "").toLowerCase();
  if (POOL[a]) return a;
  return "geral";
}

export function suggestActions(
  area: string | null | undefined,
  title: string,
  phase: JourneyPhase,
): JourneySuggestion[] {
  const kind = normalizeKind(area, title);
  const pool = POOL[kind]?.[phase] ?? POOL.geral[phase];
  // Ordena por peso da escolha do usuário; empate mantém ordem do pool
  // (a mais "primária" primeiro).
  const scored = pool.map((s, i) => ({
    s,
    score: choiceWeight(kind, phase, s.id) * 10 + (pool.length - i),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((x) => x.s);
}

export function normalizeKindPublic(area: string | null | undefined, title: string): string {
  return normalizeKind(area, title);
}
