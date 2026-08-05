// PADRÃO 3.9.5 — "ícone auto-explicativo".
// Um controle compacto (só ícone/pílula) que, ao ser tocado, abre um popup
// curto explicando o que é aquilo. O popup tem três saídas:
//   (a) X          → fecha e VOLTA a aparecer nas próximas vezes
//   (b) ação       → botão principal opcional (ligar/desligar, autorizar…)
//   (c) não mostrar mais → persiste em localStorage (wimi.hint.<id>.dismissed)
// Quando dispensado, o ícone continua visível (indicando estado) e o toque
// executa direto a ação principal, sem abrir a explicação.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const key = (id: string) => `wimi.hint.${id}.dismissed`;

export function isHintDismissed(id: string): boolean {
  try {
    return localStorage.getItem(key(id)) === "1";
  } catch {
    return false;
  }
}

export type HintIconProps = {
  /** id estável — define a chave de "não mostrar mais". */
  id: string;
  /** título curto do popup. */
  title: string;
  /** explicação (1–3 linhas). */
  description: ReactNode;
  /** conteúdo do gatilho: ícone (+ rótulo curto, se houver). */
  children: ReactNode;
  /** rótulo acessível do gatilho. */
  ariaLabel: string;
  /** estado ligado — só estiliza o gatilho. */
  active?: boolean;
  /** ação principal opcional dentro do popup. */
  action?: { label: string; onClick: () => void; closeAfter?: boolean };
  /** conteúdo extra do popup (ex.: escolha de modo). */
  extra?: ReactNode;
  className?: string;
};

export function HintIcon({
  id,
  title,
  description,
  children,
  ariaLabel,
  active,
  action,
  extra,
  className,
}: HintIconProps) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onTrigger = useCallback(() => {
    if (isHintDismissed(id)) {
      action?.onClick();
      return;
    }
    setOpen((v) => !v);
  }, [action, id]);

  return (
    <div ref={boxRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={onTrigger}
        aria-label={ariaLabel}
        aria-expanded={open}
        {...(active != null ? { "aria-pressed": active } : {})}
        className={cn(
          "inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition active:scale-95",
          active
            ? "border-ember bg-ember/20 text-ember"
            : "border-border bg-charcoal-950/40 text-muted-foreground",
        )}
      >
        {children}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={title}
          className="absolute right-0 z-40 mt-2 w-[min(17rem,calc(100vw-2.5rem))] rounded-2xl border border-border bg-charcoal-900 p-3 shadow-xl"
        >
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 font-display text-[11px] uppercase tracking-[0.14em] text-ember">
              {title}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar explicação"
              className="shrink-0 rounded-full border border-border p-1 text-muted-foreground active:scale-95"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {description}
          </div>
          {extra ? <div className="mt-2">{extra}</div> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {action ? (
              <button
                type="button"
                onClick={() => {
                  action.onClick();
                  if (action.closeAfter !== false) setOpen(false);
                }}
                className="rounded-full border border-ember/50 bg-ember/10 px-3 py-1 text-[11px] text-ember active:scale-95"
              >
                {action.label}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem(key(id), "1");
                } catch {
                  /* ignora */
                }
                setOpen(false);
              }}
              className="text-[10px] text-muted-foreground underline underline-offset-2 active:scale-95"
            >
              não mostrar mais
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
