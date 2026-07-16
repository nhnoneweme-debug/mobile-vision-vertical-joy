import {
  Home,
  Swords,
  Dumbbell,
  UtensilsCrossed,
  Moon,
  Sprout,
  Users,
  Sparkles,
  Trophy,
  ClipboardCheck,
  Accessibility,
  type LucideIcon,
} from "lucide-react";


export type AreaStatus = "novo" | "ativo" | "bloqueado";

export type Area = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  status: AreaStatus;
  /** Bento spans on a 4-col mobile grid */
  colSpan: 1 | 2 | 3 | 4;
  rowSpan: 1 | 2;
};

export const AREAS: Area[] = [
  {
    slug: "missoes",
    name: "Centro de Missões",
    tagline: "Suas quests do dia",
    description:
      "Onde você abre as missões diárias, mantém o streak e ganha XP por consistência real.",
    icon: Swords,
    status: "ativo",
    colSpan: 4,
    rowSpan: 1,
  },
  {
    slug: "treino",
    name: "Área de Treino",
    tagline: "Acender o corpo",
    description:
      "Treino do dia, percepção de esforço, limitações e check-in pós-treino.",
    icon: Dumbbell,
    status: "novo",
    colSpan: 2,
    rowSpan: 2,
  },
  {
    slug: "cozinha",
    name: "Cozinha",
    tagline: "Nutrição & água",
    description:
      "Refeições, hidratação, hábitos alimentares e restrições.",
    icon: UtensilsCrossed,
    status: "novo",
    colSpan: 2,
    rowSpan: 1,
  },
  {
    slug: "quarto",
    name: "Quarto",
    tagline: "Sono & recuperação",
    description:
      "Horas e qualidade do sono, energia ao acordar, recuperação muscular.",
    icon: Moon,
    status: "novo",
    colSpan: 2,
    rowSpan: 1,
  },
  {
    slug: "mental",
    name: "Jardim Mental",
    tagline: "Comportamento",
    description:
      "Motivação, disciplina, crença limitante e reflexão diária.",
    icon: Sprout,
    status: "novo",
    colSpan: 2,
    rowSpan: 1,
  },
  {
    slug: "social",
    name: "Praça Social",
    tagline: "Amigos & grupos",
    description: "Convivência saudável, missões sociais, grupos e equipes.",
    icon: Users,
    status: "novo",
    colSpan: 2,
    rowSpan: 1,
  },
  {
    slug: "coach",
    name: "Torre do Mentor",
    tagline: "Coach IA",
    description:
      "Conversa com os NPCs e a IA que orienta sua jornada.",
    icon: Sparkles,
    status: "novo",
    colSpan: 2,
    rowSpan: 1,
  },
  {
    slug: "progresso",
    name: "Templo do Progresso",
    tagline: "Weme Score",
    description:
      "Sua evolução: score, medidas, fotos opcionais e relatórios.",
    icon: Trophy,
    status: "novo",
    colSpan: 2,
    rowSpan: 1,
  },
  {
    slug: "orientador",
    name: "Sala do Orientador",
    tagline: "Painel profissional",
    description:
      "Para personal trainers: alunos, alertas e missões do orientador.",
    icon: ClipboardCheck,
    status: "novo",
    colSpan: 2,
    rowSpan: 1,
  },

  {
    slug: "casa",
    name: "Casa",
    tagline: "Perfil & avatar",
    description: "Seus dados, avatar, classe comportamental e consentimentos.",
    icon: Home,
    status: "ativo",
    colSpan: 2,
    rowSpan: 1,
  },
  {
    slug: "inclusao",
    name: "Refúgio Inclusivo",
    tagline: "Você como você é",
    description:
      "Pronomes, acessibilidade, tom da IA e crenças que te fortalecem — tudo respeitado em todo o jogo.",
    icon: Accessibility,
    status: "novo",
    colSpan: 2,
    rowSpan: 1,
  },
];


export function getArea(slug: string): Area | undefined {
  return AREAS.find((a) => a.slug === slug);
}
