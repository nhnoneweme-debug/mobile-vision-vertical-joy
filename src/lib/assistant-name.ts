// Módulo puro (sem server fns) — o endpoint de IA e o cliente precisam dos dois
// da mesma fonte, e importar assistant.functions.ts aqui arrastaria createServerFn.

/** Como a inteligência digital se chama quando o usuário não escolheu um nome. */
export const ASSISTANT_NAME_FALLBACK = "Weme";
export const ASSISTANT_NAME_MAX = 24;

/**
 * Nome efetivo da IA. Ponto único de fallback — o banco guarda '' pra
 * distinguir "não escolheu" de "escolheu Weme".
 */
export function assistantName(s: { assistant_name?: string | null } | null | undefined): string {
  return s?.assistant_name?.trim() || ASSISTANT_NAME_FALLBACK;
}

/**
 * Saudação da IA. Forma neutra de gênero de propósito: o nome é livre, então
 * "Sou a <nome>" erraria a concordância em metade dos casos.
 */
export function assistantGreeting(nome: string): string {
  return `Oi! Aqui é ${nome}, sua inteligência digital. Me conta o que você quer — treino, dieta, um hábito ou um compromisso. Eu pergunto o que faltar e monto uma proposta pra você confirmar.`;
}
