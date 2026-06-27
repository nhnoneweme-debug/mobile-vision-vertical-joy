// Sistema de classificação comportamental — calcula a classe a partir
// de 6 respostas em escala 1–5 ao longo de 5 eixos.

export type BehavioralClass =
  | "executor"
  | "estrategista"
  | "explorador"
  | "guardiao"
  | "visionario";

export type BehaviorAxis =
  | "execucao"
  | "planejamento"
  | "exploracao"
  | "cuidado"
  | "visao";

export type BehaviorScores = Record<BehaviorAxis, number>;

export type BehaviorQuestion = {
  id: string;
  prompt: string;
  hint?: string;
  // peso por eixo: 1 = pergunta principal desse eixo, 0.5 = secundária
  axes: Partial<Record<BehaviorAxis, number>>;
  invert?: boolean; // true se 1 = forte, 5 = fraco (raro)
};

export const BEHAVIOR_QUESTIONS: BehaviorQuestion[] = [
  {
    id: "q1",
    prompt: "Quando recebo uma meta, eu já saio fazendo.",
    hint: "1 = penso muito antes · 5 = ajo na hora",
    axes: { execucao: 1, planejamento: -0.3 },
  },
  {
    id: "q2",
    prompt: "Gosto de planejar a semana antes de começar.",
    hint: "1 = improviso · 5 = planejo tudo",
    axes: { planejamento: 1, execucao: -0.2 },
  },
  {
    id: "q3",
    prompt: "Curto experimentar exercícios e rotinas novas.",
    axes: { exploracao: 1 },
  },
  {
    id: "q4",
    prompt: "Cuido bem do meu corpo, sono e recuperação.",
    axes: { cuidado: 1 },
  },
  {
    id: "q5",
    prompt: "Penso muito no meu 'eu futuro' e em onde quero chegar.",
    axes: { visao: 1, planejamento: 0.3 },
  },
  {
    id: "q6",
    prompt: "Prefiro consistência diária do que grandes saltos.",
    axes: { cuidado: 0.5, execucao: 0.5 },
  },
];

export const CLASS_BY_AXIS: Record<BehaviorAxis, BehavioralClass> = {
  execucao: "executor",
  planejamento: "estrategista",
  exploracao: "explorador",
  cuidado: "guardiao",
  visao: "visionario",
};

export const CLASS_META: Record<
  BehavioralClass,
  { name: string; tagline: string; description: string; emblem: string }
> = {
  executor: {
    name: "Executor",
    tagline: "AÇÃO É SEU IDIOMA",
    description:
      "Você não espera condições perfeitas — faz acontecer. Seu mundo recompensa cada movimento real.",
    emblem: "⚡",
  },
  estrategista: {
    name: "Estrategista",
    tagline: "PLANO ANTES DO PASSO",
    description:
      "Você enxerga o tabuleiro antes de jogar. Vamos construir rotinas que rendem semana após semana.",
    emblem: "♟",
  },
  explorador: {
    name: "Explorador",
    tagline: "MOVIDO POR NOVIDADE",
    description:
      "Variedade é o que te mantém aceso. Suas quests vão rotacionar para nunca virar rotina.",
    emblem: "🧭",
  },
  guardiao: {
    name: "Guardião",
    tagline: "ZELO COMO FORÇA",
    description:
      "Cuidar é seu superpoder. Foco em recuperação, sono e constância silenciosa.",
    emblem: "🛡",
  },
  visionario: {
    name: "Visionário",
    tagline: "FUTURO COMO BÚSSOLA",
    description:
      "Você vive ancorado no eu-futuro. Cada quest é um degrau visível desse horizonte.",
    emblem: "✦",
  },
};

export function computeBehavior(
  answers: Record<string, number>,
): { class: BehavioralClass; scores: BehaviorScores } {
  const scores: BehaviorScores = {
    execucao: 0,
    planejamento: 0,
    exploracao: 0,
    cuidado: 0,
    visao: 0,
  };

  for (const q of BEHAVIOR_QUESTIONS) {
    const raw = answers[q.id] ?? 3;
    const value = q.invert ? 6 - raw : raw;
    for (const [axis, weight] of Object.entries(q.axes) as [
      BehaviorAxis,
      number,
    ][]) {
      scores[axis] += value * weight;
    }
  }

  // Determinístico: tiebreak pela ordem fixa dos eixos
  const order: BehaviorAxis[] = [
    "execucao",
    "planejamento",
    "exploracao",
    "cuidado",
    "visao",
  ];
  let winner: BehaviorAxis = "execucao";
  let best = -Infinity;
  for (const axis of order) {
    if (scores[axis] > best) {
      best = scores[axis];
      winner = axis;
    }
  }
  return { class: CLASS_BY_AXIS[winner], scores };
}
