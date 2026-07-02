import { useEffect, useId, useRef, type ReactNode } from "react";
import { useViewport } from "@/providers/ViewportProvider";

const IS_DEV = import.meta.env.DEV;

export type ViewportGuardProps = {
  children: ReactNode;
  label?: string;
  isOverlay?: boolean;
  /** Extra pixels of slack before considering out-of-bounds. Default 1px. */
  tolerance?: number;
};

export function ViewportGuard({
  children,
  label,
  isOverlay = false,
  tolerance = 1,
}: ViewportGuardProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const autoId = useId();
  const id = `${isOverlay ? "overlay" : "page"}:${label ?? autoId}`;
  const { width, height, resizeCount, reportGuard, removeGuard } = useViewport();
  const outRef = useRef({ x: 0, y: 0, out: false });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof window === "undefined") return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      // Overflow = amount content exceeds viewport (right/bottom edges)
      const rightOverflow = Math.max(0, Math.ceil(rect.right - winW - tolerance));
      const bottomOverflow = Math.max(0, Math.ceil(rect.bottom - winH - tolerance));
      const widthOverflow = Math.max(0, Math.ceil(el.scrollWidth - winW - tolerance));
      const overflowX = Math.max(rightOverflow, widthOverflow);
      const overflowY = bottomOverflow;
      const outOfBounds = overflowX > 0 || overflowY > 0;

      const prev = outRef.current;
      if (prev.x === overflowX && prev.y === overflowY && prev.out === outOfBounds) return;
      outRef.current = { x: overflowX, y: overflowY, out: outOfBounds };

      if (outOfBounds) {
        // eslint-disable-next-line no-console
        console.warn(
          `[ViewportGuard] "${id}" out of bounds: +${overflowX}px X, +${overflowY}px Y (viewport ${winW}×${winH})`,
        );
      }

      reportGuard({
        id,
        label: label ?? id,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        overflowX,
        overflowY,
        outOfBounds,
        isOverlay,
        updatedAt: Date.now(),
      });
    };

    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    const mo = new MutationObserver(() => measure());
    mo.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });

    return () => {
      ro.disconnect();
      mo.disconnect();
      removeGuard(id);
    };
    // Re-measure whenever window size changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, width, height, resizeCount, tolerance, isOverlay, label]);

  const devStyle: React.CSSProperties | undefined =
    IS_DEV && outRef.current.out
      ? {
          outline: "2px dashed #ff3b3b",
          outlineOffset: "-2px",
          position: "relative",
        }
      : undefined;

  return (
    <div
      ref={wrapperRef}
      data-viewport-guard={id}
      data-out-of-bounds={outRef.current.out ? "true" : "false"}
      style={devStyle}
    >
      {children}
      {IS_DEV && outRef.current.out ? (
        <span
          style={{
            position: "fixed",
            top: isOverlay ? 44 : 8,
            right: 8,
            zIndex: 2147483000,
            background: "#ff3b3b",
            color: "white",
            font: "11px/1.2 system-ui, sans-serif",
            padding: "3px 6px",
            borderRadius: 6,
            pointerEvents: "none",
          }}
        >
          {label ?? id} · +{outRef.current.x}px X · +{outRef.current.y}px Y
        </span>
      ) : null}
    </div>
  );
}
