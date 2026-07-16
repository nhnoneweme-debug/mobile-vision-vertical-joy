// Módulo puro (sem server fns) — o endpoint de IA e o cliente precisam dos dois
// da mesma fonte, e importar assistant.functions.ts aqui arrastaria createServerFn.

/** Como a inteligência digital se chama quando o usuário não escolheu um nome. */
export const ASSISTANT_NAME_FALLBACK = "WiMi";
export const ASSISTANT_NAME_MAX = 24;

/**
 * Nome efetivo da IA. Ponto único de fallback — o banco guarda '' pra
 * distinguir "não escolheu" de "escolheu WiMi".
 */
export function assistantName(s: { assistant_name?: string | null } | null | undefined): string {
  return s?.assistant_name?.trim() || ASSISTANT_NAME_FALLBACK;
}

/**
 * Saudação da IA. Texto único que aparece na primeira bolha do /assistente.
 */
export function assistantGreeting(nome: string): string {
  return `Oi, sou o ${nome}, sua inteligência digital. O que vamos trabalhar hoje?`;
}
