import { useCallback, useEffect, useRef, useState } from "react";
import { Coffee } from "lucide-react";
import { useWakeLockContext } from "@/providers/WakeLockProvider";

// Micro-botão flutuante do modo foco (Wake Lock), agora ARRASTÁVEL e
// ANCORÁVEL. Guarda a posição como fração da viewport no localStorage para
// sobreviver a rotação/resize, faz snap suave à borda mais próxima e distingue
// TAP (toggle) de DRAG (mover) por limiar de deslocamento.

const POS_KEY = "wimi.focusbutton.pos.v1";
const SIZE = 44; // h-11 w-11
const MARGIN = 12;
const DRAG_THRESHOLD = 8;

type Frac = { x: number; y: number };

function readPos(): Frac | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Frac;
    if (typeof p?.x !== "number" || typeof p?.y !== "number") return null;
    return p;
  } catch {
    return null;
  }
}

function writePos(p: Frac) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    /* storage opcional */
  }
}

function insets() {
  const cs = getComputedStyle(document.documentElement);
  const read = (v: string) => parseFloat(cs.getPropertyValue(v) || "0") || 0;
  // Fallback: env() não é legível direto; usamos variáveis se existirem.
  return {
    top: read("--sat"),
    bottom: read("--sab"),
  };
}

/** Limites em px para o canto superior-esquerdo do botão. */
function bounds() {
  const { top, bottom } = insets();
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    minX: MARGIN,
    maxX: Math.max(MARGIN, w - SIZE - MARGIN),
    // respeita safe-areas e as barras do shell (topo ~8, fundo ~76 da bottom bar)
    minY: MARGIN + top + 8,
    maxY: Math.max(MARGIN, h - SIZE - MARGIN - bottom - 76),
  };
}

function clampPx(x: number, y: number) {
  const b = bounds();
  return {
    x: Math.min(b.maxX, Math.max(b.minX, x)),
    y: Math.min(b.maxY, Math.max(b.minY, y)),
  };
}

function toFrac(x: number, y: number): Frac {
  return { x: x / Math.max(1, window.innerWidth), y: y / Math.max(1, window.innerHeight) };
}

function fromFrac(p: Frac) {
  return clampPx(p.x * window.innerWidth, p.y * window.innerHeight);
}

/** Snap: borda mais próxima (esquerda/direita, ou topo/fundo se estiver mais perto). */
function snap(x: number, y: number) {
  const b = bounds();
  const cx = x + SIZE / 2;
  const cy = y + SIZE / 2;
  const dLeft = cx - b.minX;
  const dRight = b.maxX + SIZE / 2 - cx + SIZE / 2;
  const dTop = cy - b.minY;
  const dBottom = b.maxY + SIZE / 2 - cy + SIZE / 2;
  const min = Math.min(dLeft, dRight, dTop, dBottom);
  if (min === dTop) return clampPx(x, b.minY);
  if (min === dBottom) return clampPx(x, b.maxY);
  if (min === dLeft) return clampPx(b.minX, y);
  return clampPx(b.maxX, y);
}

export function FocusFloatingButton() {
  const wake = useWakeLockContext();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ px: 0, py: 0, x: 0, y: 0, moved: false });

  // Posição inicial: salva ou canto inferior direito.
  useEffect(() => {
    const saved = readPos();
    if (saved) {
      setPos(fromFrac(saved));
    } else {
      const b = bounds();
      setPos({ x: b.maxX, y: b.maxY });
    }
  }, []);

  // Re-clampa em resize/rotação.
  useEffect(() => {
    const onResize = () => {
      const saved = readPos();
      setPos(saved ? fromFrac(saved) : (p) => (p ? clampPx(p.x, p.y) : p) as never);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!pos) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      startRef.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y, moved: false };
      setDragging(true);
    },
    [pos],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragging) return;
      const s = startRef.current;
      const dx = e.clientX - s.px;
      const dy = e.clientY - s.py;
      if (!s.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      s.moved = true;
      setPos(clampPx(s.x + dx, s.y + dy));
    },
    [dragging],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragging) return;
      setDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      const s = startRef.current;
      if (!s.moved) {
        void wake.toggle();
        return;
      }
      setPos((p) => {
        if (!p) return p;
        const next = snap(p.x, p.y);
        writePos(toFrac(next.x, next.y));
        return next;
      });
    },
    [dragging, wake],
  );

  if (!wake.supported || !pos) return null;

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      aria-label={wake.active ? "Liberar tela (desligar modo foco)" : "Manter tela acesa (modo foco)"}
      aria-pressed={wake.active}
      title={wake.active ? "Modo foco ativo — tela sempre acesa" : "Manter tela acesa"}
      className={
        "fixed left-0 top-0 z-40 grid h-11 w-11 touch-none place-items-center rounded-full border border-border shadow-lg backdrop-blur-xl " +
        (dragging ? "scale-110 transition-transform" : "transition-all duration-300") +
        " " +
        (wake.active
          ? "bg-ember text-charcoal-900 shadow-ember/40"
          : "bg-charcoal-900/85 text-muted-foreground hover:text-foreground")
      }
      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)${dragging ? " scale(1.1)" : ""}` }}
    >
      <Coffee className="h-5 w-5" strokeWidth={2.2} />
      {wake.active && (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-ember shadow-[0_0_8px] shadow-ember ring-2 ring-background" />
      )}
    </button>
  );
}
