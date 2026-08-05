// CAMADA 4.0 — AGENDA DE SEGUNDO PLANO DAS AÇÕES.
//
// Só ações com condição de HORÁRIO ABSOLUTO ("todo dia às 14:00") podem ser
// entregues com o app fechado: o servidor precisa saber a hora exata do envio.
// Tudo que depende dos sinais do Live (palavra-chave, blocos de fala, silêncio,
// "a cada X min de sessão") só existe com o painel aberto — e a UI diz isso.

import {
  isWithinWindow,
  type TriggerAction,
  type TriggerDefinition,
} from "@/lib/triggers";

export type ActionOccurrence = {
  trigger_id: string;
  fire_at: string;
  title: string;
  body: string;
};

/** Ação elegível a notificação em segundo plano (horário absoluto). */
export function isBackgroundCapable(t: Pick<TriggerDefinition, "condition">): boolean {
  const c = t.condition as Record<string, unknown>;
  return c?.mode === "at_time" && typeof c.time === "string" && /^\d{1,2}:\d{2}$/.test(c.time);
}

function actionBody(a: TriggerAction | null | undefined, name: string): string {
  const act = a ?? {};
  return (
    act.message ??
    act.prompt?.instruction ??
    act.custom?.plan ??
    act.custom?.instruction ??
    (act.journey_log_prompt ? "O que você está executando agora?" : `Hora de: ${name}`)
  );
}

/**
 * Próximas ocorrências (em ISO) de todas as ações de horário habilitadas,
 * respeitando a janela ativa, para os próximos `days` dias.
 */
export function buildActionOccurrences(
  triggers: TriggerDefinition[],
  days = 3,
  now: Date = new Date(),
): ActionOccurrence[] {
  const out: ActionOccurrence[] = [];
  for (const t of triggers) {
    if (!t.enabled || !isBackgroundCapable(t)) continue;
    const c = t.condition as unknown as { time: string };
    const m = /^(\d{1,2}):(\d{2})$/.exec(c.time);
    if (!m) continue;
    for (let d = 0; d <= days; d += 1) {
      const at = new Date(now);
      at.setDate(at.getDate() + d);
      at.setHours(Number(m[1]), Number(m[2]), 0, 0);
      if (at.getTime() <= now.getTime()) continue;
      if (!isWithinWindow(t.active_window, at)) continue;
      out.push({
        trigger_id: t.id,
        fire_at: at.toISOString(),
        title: `WiMi · ${t.name}`,
        body: actionBody(t.action, t.name).slice(0, 240),
      });
    }
  }
  return out;
}

/** Rótulo honesto do nível de garantia de uma ação. */
export function guaranteeLabel(
  t: Pick<TriggerDefinition, "condition">,
  pushOn: boolean,
): { text: string; strong: boolean } {
  if (isBackgroundCapable(t) && pushOn)
    return { text: "avisa mesmo com o app fechado (notificação)", strong: true };
  if (isBackgroundCapable(t))
    return { text: "anuncia com o app aberto · ative as notificações para o app fechado", strong: false };
  return { text: "anuncia só com o app aberto (depende dos sinais do Live)", strong: false };
}
