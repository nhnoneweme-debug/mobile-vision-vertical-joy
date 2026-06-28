import type { BehavioralClass } from "./behavior";

export type QuestInput = {
  goal?: string | null;
  level?: string | null;
  time_per_day_min?: number | null;
  behavioral_class?: BehavioralClass | string | null;
};

export type Quest = {
  title: string;
  subtitle: string;
  xp: number;
  slug: string;
};

const GOAL_TITLES: Record<string, string> = {
  emagrecer: "Acender o Forno",
  hipertrofia: "Forjar o Corpo",
  saude: "Despertar Vital",
  performance: "Romper o Limite",
  mente: "Afiar a Mente",
};

const CLASS_VOICES: Record<string, (mins: number) => string> = {
  executor: (m) => `Bloco direto de ${m} min. Sem pensar — só executar.`,
  estrategista: (m) =>
    `Plano de ${m} min, 3 estações. Comece pela primeira agora.`,
  explorador: (m) =>
    `Versão nova hoje: ${m} min com 1 movimento que você nunca fez.`,
  guardiao: (m) =>
    `${m} min em ritmo cuidado. Foco em respiração e postura.`,
  visionario: (m) =>
    `${m} min conectando o eu de hoje ao eu de daqui a 6 meses.`,
};

export function buildDailyQuest(input: QuestInput): Quest {
  const goal = (input.goal ?? "saude").toLowerCase();
  const mins = input.time_per_day_min ?? 30;
  const cls = (input.behavioral_class ?? "executor").toLowerCase();

  const baseTitle = GOAL_TITLES[goal] ?? "Quest do Dia";
  const voice = CLASS_VOICES[cls] ?? CLASS_VOICES.executor;

  const xp = 50 + Math.min(150, Math.round(mins * 2));

  return {
    title: baseTitle,
    subtitle: voice(mins),
    xp,
    slug: goal === "mente" ? "mente" : "treino",
  };
}
