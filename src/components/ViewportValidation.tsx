import { useEffect, useRef, useState } from "react";
import { useViewport } from "@/providers/ViewportProvider";

const IS_DEV = import.meta.env.DEV;

export function ViewportValidation() {
  const {
    width,
    height,
    resizeCount,
    isListening,
    breakpoint,
    guards,
  } = useViewport();
  const lastCountRef = useRef(resizeCount);
  const heardRef = useRef(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (resizeCount > lastCountRef.current) {
    heardRef.current = true;
    lastCountRef.current = resizeCount;
  }

  useEffect(() => {
    if (!IS_DEV) return;
    const rows = Object.values(guards).map((g) => ({
      id: g.id,
      status: g.outOfBounds ? `✗ +${g.overflowX}X/+${g.overflowY}Y` : "✔ ok",
      w: g.width,
      h: g.height,
      overlay: g.isOverlay,
    }));
    // eslint-disable-next-line no-console
    console.table({
      viewport: { width, height, breakpoint, resizeCount, isListening },
      ...Object.fromEntries(rows.map((r) => [r.id, r])),
    });
  }, [guards, width, height, breakpoint, resizeCount, isListening]);

  if (!IS_DEV) return null;

  const guardList = Object.values(guards);
  const anyOut = guardList.some((g) => g.outOfBounds);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        left: 8,
        zIndex: 2147483001,
        maxWidth: 280,
        maxHeight: "40vh",
        overflow: "auto",
        background: "rgba(15,15,15,0.9)",
        color: "#eee",
        font: "11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace",
        padding: "8px 10px",
        borderRadius: 8,
        border: `1px solid ${anyOut ? "#ff3b3b" : "#333"}`,
        pointerEvents: "none",
      }}
    >
      <div>
        {heardRef.current ? "✔" : "…"} resize (n={resizeCount}){" "}
        {isListening ? "" : " · not listening!"}
      </div>
      <div>
        {width}×{height} · {breakpoint}
      </div>
      <div style={{ marginTop: 4, opacity: 0.8 }}>
        guards: {guardList.length}
      </div>
      {guardList.map((g) => (
        <div key={g.id} style={{ color: g.outOfBounds ? "#ff9c9c" : "#a7f3d0" }}>
          {g.outOfBounds ? "✗" : "✔"} {g.id}
          {g.outOfBounds ? ` +${g.overflowX}X/+${g.overflowY}Y` : ""}
        </div>
      ))}
    </div>
  );
}
