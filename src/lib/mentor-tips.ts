// Conteúdo do Mentor — explica cada rota de forma curta e propõe perguntas
// que o jogador pode mandar pra IA-Coletora (preenche o input de /ia).

export type MentorTip = {
  title: string;
  blurb: string;
  questions: string[];
};

const DEFAULT: MentorTip = {
  title: "Mentor",
  blurb:
    "Eu te guio aqui dentro. Pergunta qualquer coisa sobre o sistema, as regras, ou peça pra eu organizar algo do seu dia.",
  questions: [
    "Como funciona o sistema?",
    "Por onde devo começar agora?",
    "Resume o que importa pra hoje",
  ],
};

const TIPS: Record<string, MentorTip> = {
  "/mapa": {
    title: "Mapa do mundo",
    blurb:
      "Cada área é um pedaço da sua vida. Toque numa pra abrir as missões dela. O card no topo é sua Quest do dia — faça check-in pra ganhar XP e manter o streak.",
    questions: [
      "Qual área devo focar essa semana?",
      "Por que tenho tantas missões abertas?",
      "Me explica o sistema de XP e brasas",
    ],
  },
  "/jornada": {
    title: "Jornada do dia",
    blurb:
      "Monte os blocos do seu dia: refeições, treino, foco, ritual. Cada bloco marcado vira XP. Peça pra eu montar baseado na sua rotina ou adicione manual.",
    questions: [
      "Monta minha jornada de hoje",
      "Como organizar treino + trabalho?",
      "Sugere um dia mais leve hoje",
    ],
  },
  "/painel": {
    title: "Centro de Missões",
    blurb:
      "Aqui ficam as missões diárias, semanais e do orientador. O botão + cria uma nova missão sua ou peça pra mim pelo chat.",
    questions: [
      "Cria uma missão de leitura 20 min/dia",
      "Como funciona o streak?",
      "Quais missões valem mais XP?",
    ],
  },
  "/ia": {
    title: "IA-Coletora",
    blurb:
      "Despeje o que estiver na cabeça — texto ou áudio. Eu organizo, registro hábitos, rituais e insights pra você. Coisas de baixo risco eu já salvo; pra perfil e metas peço sua confirmação.",
    questions: [
      "Quero manter foco em dieta e treino",
      "Anota: dormi 6h e acordei cansado",
      "Cria o hábito de beber 2L de água",
    ],
  },
  "/habitos": {
    title: "Hábitos",
    blurb:
      "Hábitos são repetições com meta semanal. Toque pra fazer log de hoje. Consistência vira XP e desbloqueia conquistas.",
    questions: [
      "Sugere 3 hábitos pro meu perfil",
      "Como manter um hábito por 30 dias?",
      "Quais hábitos estou falhando?",
    ],
  },
  "/social": {
    title: "Praça Social",
    blurb:
      "Compartilhe brasas com amigos. Adicione gente pelo código, crie grupos, troque progresso. Tudo opcional.",
    questions: [
      "Como adiciono um amigo?",
      "Qual meu código de amizade?",
      "Como criar um grupo?",
    ],
  },
  "/calendario": {
    title: "Calendário",
    blurb:
      "Veja seu heatmap de XP, agende quests futuras e organize metas trimestrais. XP futuro fica selado até o dia chegar.",
    questions: [
      "Agenda uma quest de leitura amanhã",
      "Como definir uma meta trimestral?",
      "Resume minha semana",
    ],
  },
  "/conquistas": {
    title: "Conquistas & Saga",
    blurb:
      "Cada conquista desbloqueia um fragmento da Saga — a história do Oráculo das Brasas que se monta conforme você evolui.",
    questions: [
      "Quais conquistas estão mais próximas?",
      "O que é a Saga?",
      "Como subir de raridade?",
    ],
  },
  "/classe": {
    title: "Sua Classe",
    blurb:
      "Árvore de habilidades comportamentais. Cada nó destrava perks que mudam como o jogo te trata.",
    questions: [
      "Qual o próximo nó pra investir?",
      "Como ganhar pontos de classe?",
      "Me explica minha classe",
    ],
  },
  "/progresso": {
    title: "Weme Score",
    blurb:
      "Seu score consolida treino, sono, mente, social e disciplina. Toque nos anéis pra ver o que puxa pra cima ou pra baixo.",
    questions: [
      "Por que meu score caiu?",
      "Como subir 10 pontos no score?",
      "Qual área tá mais fraca?",
    ],
  },
  "/perfil": {
    title: "Seu Perfil",
    blurb:
      "Dados básicos, avatar, classe, idioma e notificações. Tudo daqui pode ser pedido também pelo chat — eu confirmo antes de mudar.",
    questions: [
      "Muda meu objetivo pra hipertrofia",
      "Aumenta meu tempo/dia pra 60 min",
      "Como troco meu nome?",
    ],
  },
  "/loja": {
    title: "Loja das Brasas",
    blurb:
      "Gaste brasas em perks, skins e cristais. Brasas vêm de consistência real — sem atalho.",
    questions: [
      "Quanto custa cada perk?",
      "Como ganhar mais brasas?",
      "O que vale a pena comprar?",
    ],
  },
  "/ritual": {
    title: "Ritual diário",
    blurb:
      "Abrir e fechar o dia com intenção. Manhã: foco. Noite: revisão. Cada ritual vale +25 XP.",
    questions: [
      "Como faço o ritual da manhã?",
      "Pula a parte de gratidão hoje",
      "Me ajuda a refletir o dia",
    ],
  },
  "/despertar": {
    title: "Companheira do Despertar",
    blurb:
      "Alarme conversacional. Eu te acordo, registro sonhos e ajusto seu próximo snooze de forma adaptativa.",
    questions: [
      "Como configurar o despertar?",
      "Registra meu sonho de ontem",
      "Por que o snooze muda?",
    ],
  },
  "/dormir": {
    title: "Ritual Noturno",
    blurb:
      "Faça o dump do dia. Eu organizo no banco: hábitos, insights, plano de amanhã.",
    questions: [
      "Hoje foi um dia difícil",
      "Planeja meu dia de amanhã",
      "Resume o que aconteceu hoje",
    ],
  },
  "/sonhos": {
    title: "Diário de Sonhos",
    blurb:
      "Sonhos contam padrões da mente. Registre o que lembrar — mesmo fragmento solto vale.",
    questions: [
      "Sonhei com água, o que pode ser?",
      "Por que registrar sonhos?",
      "Mostra padrões dos meus sonhos",
    ],
  },
};

export function getMentorTip(pathname: string): MentorTip {
  // /area/casa, /area/cozinha etc.
  if (pathname.startsWith("/area/")) {
    const slug = pathname.split("/")[2] ?? "";
    return {
      title: `Área · ${slug}`,
      blurb:
        "Cada área tem 4 missões por nível. Complete pra subir o nível da área e ganhar XP global.",
      questions: [
        `Qual a próxima missão de ${slug}?`,
        "Como subo de nível nesta área?",
        "Sugere uma missão extra hoje",
      ],
    };
  }
  return TIPS[pathname] ?? DEFAULT;
}
