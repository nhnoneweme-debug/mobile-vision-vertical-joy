// PADRÃO 3.9.5 — "ícone auto-explicativo".
// Um controle compacto (só ícone/pílula) que, ao ser tocado, abre um popup
// curto explicando o que é aquilo. O popup tem três saídas:
//   (a) X          → fecha e VOLTA a aparecer nas próximas vezes
//   (b) ação       → botão principal opcional (ligar/desligar, autorizar…)
//   (c) não mostrar mais → persiste em localStorage (wimi.hint.<id>.dismissed)
// Quando dispensado, o ícone continua visível (indicando estado) e o toque
// executa direto a ação principal, sem abrir a explicação.
//
// 3.9.6 — POSICIONAMENTO INTELIGENTE: o popup é ancorado à posição REAL do
// gatilho na viewport (getBoundingClientRect no momento da abertura), com
// colisão vertical (abre pra baixo em cima da tela, pra cima embaixo) e
// horizontal (clamp nas margens, só a setinha se move). Recalcula ao rolar e
// ao redimensionar/rotacionar; fecha se o ícone sair de vista.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

/** 3.9.6 — "Restaurar instruções": apaga TODAS as chaves wimi.hint.*. */
export function resetHints(): number {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("wimi.hint.")) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    return keys.length;
  } catch {
    return 0;
  }
}

const MARGIN = 8;

type Placement = { top: number; left: number; arrow: number; up: boolean };

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
  const [pos, setPos] = useState<Placement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const pop = popRef.current;
    if (!trigger || !pop) return;
    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // ícone saiu de vista → fecha (nada de popup órfão flutuando).
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) {
      setOpen(false);
      return;
    }
    const w = Math.min(pop.offsetWidth || 272, vw - MARGIN * 2);
    const h = pop.offsetHeight || 160;
    const below = vh - r.bottom;
    const above = r.top;
    // COLISÃO VERTICAL: abre pro lado onde cabe inteiro; empatando, pro maior.
    const up = below < h + MARGIN && above > below;
    const top = up
      ? Math.max(MARGIN, r.top - h - MARGIN)
      : Math.min(Math.max(MARGIN, r.bottom + MARGIN), Math.max(MARGIN, vh - h - MARGIN));
    // COLISÃO HORIZONTAL: clamp nas margens; só a setinha acompanha o ícone.
    const center = r.left + r.width / 2;
    const left = Math.min(Math.max(MARGIN, center - w / 2), Math.max(MARGIN, vw - w - MARGIN));
    const arrow = Math.min(Math.max(center - left, 14), Math.max(14, w - 14));
    setPos({ top, left, arrow, up });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    window.addEventListener("orientationchange", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("orientationchange", onMove);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
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
        ref={triggerRef}
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
          ref={popRef}
          role="dialog"
          aria-label={title}
          style={{
            top: pos ? pos.top : -9999,
            left: pos ? pos.left : 0,
            visibility: pos ? "visible" : "hidden",
          }}
          className="fixed z-50 w-[min(17rem,calc(100vw-1rem))] rounded-2xl border border-border bg-charcoal-900 p-3 shadow-xl"
        >
          {pos ? (
            <span
              aria-hidden
              style={{ left: pos.arrow, [pos.up ? "bottom" : "top"]: -4 }}
              className="absolute h-2 w-2 -translate-x-1/2 rotate-45 border border-border bg-charcoal-900"
            />
          ) : null}
          <div className="relative flex items-start gap-2">
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
