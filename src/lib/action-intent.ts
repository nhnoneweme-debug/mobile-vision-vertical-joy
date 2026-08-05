// CAMADA 4.0 — CRIAR AÇÕES PELA CONVERSA.
//
// Detecta, no texto do chat do ouvido (falado ou digitado), o pedido de criar
// uma ação. Heurística leve e local: só quando há sinal claro de agendamento /
// comando é que a conversa vira rascunho — o resto segue como conversa normal.

const CREATE_VERB =
  /\b(cri(a|e|ar)|monta|montar|programa|programar|agenda|agendar|configura|configurar|adiciona|adicionar|coloca|colocar|faz|fazer)\b/i;

const ACTION_NOUN = /\b(a[çc][ãa]o|a[çc][õo]es|alarme|lembrete|gatilho|comando|rotina|automa[çc][ãa]o|timer|pomodoro)\b/i;

const TIME_HINT =
  /(\b[àa]s?\s*\d{1,2}\s*(h|:|horas?\b)|\ba cada\s+\d+\s*(min|minuto|segundo|s\b|h\b|hora)|daqui a\s+\d+|todo dia|todos os dias|toda\s+(segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo))/i;

const EVENT_HINT =
  /\bquando\s+(eu\s+(disser|falar)|a\s+sess[ãa]o|come[çc]ar|eu\s+registrar|ficar\s+em\s+sil[êe]ncio)/i;

const REMIND_HINT = /\b(me\s+(lembra|lembre|avisa|avise|pergunta|pergunte|chama|chame|cutuca))\b/i;

/**
 * Verdadeiro quando a frase é um PEDIDO DE CRIAÇÃO DE AÇÃO e não uma pergunta
 * qualquer. Exige (verbo de criação + substantivo de ação) OU um pedido de
 * lembrete/comando acompanhado de âncora de tempo ou evento.
 */
export function looksLikeActionRequest(text: string): boolean {
  const t = (text ?? "").trim();
  if (t.length < 8) return false;
  if (/\?\s*$/.test(t) && !CREATE_VERB.test(t)) return false;

  const created = CREATE_VERB.test(t) && ACTION_NOUN.test(t);
  const anchored = TIME_HINT.test(t) || EVENT_HINT.test(t);
  const asked = REMIND_HINT.test(t) || ACTION_NOUN.test(t);

  return created || (anchored && asked);
}
