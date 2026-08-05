// OVERLAY DE PRÓXIMAS AÇÕES — camada leve e não bloqueante sobre o Live.
// Três linhas: AGORA, PRÓXIMA e DEPOIS. Pouca informação por linha; tocar
// numa linha abre os detalhes completos da ação.

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import {
  describeAction,
  describeCondition,
  describeWindow,
  formatCountdown,
  upcomingActions,
  type TriggerDefinition,
} from "@/lib/triggers";

export type NowLine = { label: string; detail?: string | null };

export function NextActionsOverlay({
  triggers,
  sessionStartedAt,
  now,
  big = false,
  commandsCount = 0,
  onOpenCommands,
}: {
  triggers: TriggerDefinition[];
  sessionStartedAt: number;
  now: NowLine;
  /** Modo Estação: fonte maior. */
  big?: boolean;
  /** Comandos de voz armados — contador discreto, nunca entram na fila. */
  commandsCount?: number;
  onOpenCommands?: () => void;
}) {
  const [tick, setTick] = useState(() => Date.now());
  const [open, setOpen] = useState<TriggerDefinition | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // upcomingActions já filtra: só agentes proativos elegíveis.
  const queue = upcomingActions(triggers, sessionStartedAt, tick);
  const next = queue[0] ?? null;
  const after = queue[1] ?? null;


  const size = big ? "text-[15px]" : "text-[12px]";
  const label = big ? "text-[11px]" : "text-[9px]";

  const Row = ({
    tag,
    title,
    when,
    trigger,
  }: {
    tag: string;
    title: string;
    when: string;
    trigger?: TriggerDefinition | null;
  }) => (
    <button
      type="button"
      disabled={!trigger}
      onClick={() => trigger && setOpen(trigger)}
      className="flex w-full items-baseline gap-2 py-0.5 text-left disabled:cursor-default"
    >
      <span
        className={`${label} shrink-0 font-display uppercase tracking-[0.16em] text-ember/80`}
        style={{ minWidth: big ? 72 : 54 }}
      >
        {tag}
      </span>
      <span className={`${size} min-w-0 flex-1 truncate text-foreground`}>{title}</span>
      <span className={`${size} shrink-0 text-muted-foreground`}>{when}</span>
    </button>
  );

  return (
    <>
      <div
        className={`pointer-events-auto rounded-2xl border border-ember/25 bg-charcoal-950/70 px-3 py-2 backdrop-blur-md ${
          big ? "" : "shadow-lg"
        }`}
      >
        <div className="mb-1 flex items-center gap-1.5">
          <Zap className={`${big ? "h-4 w-4" : "h-3 w-3"} text-ember`} />
          <span
            className={`${label} font-display uppercase tracking-[0.18em] text-muted-foreground`}
          >
            próximas ações
          </span>
        </div>
        <Row tag="agora" title={now.label} when={now.detail ?? ""} />
        <Row
          tag="próxima"
          title={next ? next.trigger.name : "nenhuma ação elegível"}
          when={next ? (next.etaMs != null ? formatCountdown(next.etaMs) : next.when) : "—"}
          trigger={next?.trigger}
        />
        <Row
          tag="depois"
          title={after ? after.trigger.name : "—"}
          when={after ? (after.etaMs != null ? formatCountdown(after.etaMs) : after.when) : ""}
          trigger={after?.trigger}
        />
        {commandsCount > 0 ? (
          <button
            type="button"
            onClick={onOpenCommands}
            className={`${label} mt-1 w-full text-left font-display uppercase tracking-[0.14em] text-muted-foreground underline-offset-2 active:opacity-70`}
          >
            {commandsCount} comando{commandsCount > 1 ? "s" : ""} armado
            {commandsCount > 1 ? "s" : ""}
          </button>
        ) : null}
      </div>


      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal-950/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(null)}
        >
          <div
            className="w-full max-w-[var(--shell-max,480px)] rounded-2xl border border-ember/40 bg-charcoal-900 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-base tracking-wide">{open.name}</h3>
            <dl className="mt-2 space-y-1 text-[12px] text-muted-foreground">
              <div>
                <dt className="inline font-display uppercase tracking-wide text-ember">
                  quando ·{" "}
                </dt>
                <dd className="inline">{describeCondition(open)}</dd>
              </div>
              <div>
                <dt className="inline font-display uppercase tracking-wide text-ember">faz · </dt>
                <dd className="inline">{describeAction(open)}</dd>
              </div>
              <div>
                <dt className="inline font-display uppercase tracking-wide text-ember">
                  janela ·{" "}
                </dt>
                <dd className="inline">{describeWindow(open.active_window) ?? "sempre"}</dd>
              </div>
              <div>
                <dt className="inline font-display uppercase tracking-wide text-ember">
                  cooldown ·{" "}
                </dt>
                <dd className="inline">{open.cooldown_seconds}s</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="mt-3 w-full rounded-xl border border-border py-2 text-sm text-muted-foreground active:scale-95"
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
