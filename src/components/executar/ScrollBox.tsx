// CONTENÇÃO DE CARDS QUE CRESCEM — camada 3.9, item 4.
//
// Todo bloco do Executando que acumula conteúdo com o tempo (log, fluxo do
// ouvido, listas de eventos) usa esta caixa: altura fixa de ~5 linhas com
// rolagem INTERNA, auto-scroll que respeita leitura em curso e um botão
// "expandir" que abre o conteúdo completo em tela cheia.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

export function ExpandButton({ onClick, expanded }: { onClick: () => void; expanded?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={expanded ? "Recolher" : "Expandir"}
      className="shrink-0 rounded-full border border-border p-1.5 text-muted-foreground active:scale-95"
    >
      {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
    </button>
  );
}

/**
 * Caixa rolável de altura fixa (~5 linhas por padrão). `stickKey` muda a cada
 * conteúdo novo: se o usuário está no fim, acompanha; se está lendo acima,
 * não arrasta a leitura e oferece o atalho de voltar ao fim.
 */
export function ScrollBox({
  children,
  className = "",
  heightClass = "h-40",
  stickKey,
  paused,
  jumpLabel = "↓ novidades",
}: {
  children: ReactNode;
  className?: string;
  heightClass?: string;
  stickKey?: unknown;
  /** trava o auto-scroll (ex.: edição inline em curso) */
  paused?: boolean;
  jumpLabel?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [stick, setStick] = useState(true);
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || paused) return;
    if (stick) el.scrollTop = el.scrollHeight;
    else setUnread(true);
  }, [stickKey, stick, paused]);

  const jump = useCallback(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
    setStick(true);
    setUnread(false);
  }, []);

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          setStick(atEnd);
          if (atEnd) setUnread(false);
        }}
        className={`${heightClass} overflow-y-auto overscroll-contain ${className}`}
      >
        {children}
      </div>
      {unread && !stick ? (
        <button
          type="button"
          onClick={jump}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-ember/40 bg-charcoal-950/90 px-3 py-1 text-[11px] text-ember active:scale-95"
        >
          {jumpLabel}
        </button>
      ) : null}
    </div>
  );
}

/** Visão completa em tela cheia — o "expandir" de qualquer card contido. */
export function ExpandedSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-charcoal-950/95 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-[var(--shell-max,480px)] flex-col p-4">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate font-display text-[12px] uppercase tracking-[0.18em] text-ember">
            {title}
          </h2>
          <ExpandButton onClick={onClose} expanded />
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-charcoal-900/60 p-3 pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>
      </div>
    </div>
  );
}
