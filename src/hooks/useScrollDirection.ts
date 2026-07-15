import { useEffect, useState } from "react";

// Direção de scroll da janela (window-level). Cobre tanto o scroll nativo do
// mobile quanto o smooth-scroll de desktop (src/lib/smooth-scroll.ts) — ambos
// movem window.scrollY. Respeita reduce-motion (fica sempre "up" = visível).
export function useScrollDirection(threshold = 8): "up" | "down" {
  const [dir, setDir] = useState<"up" | "down">("up");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (document.documentElement.classList.contains("reduce-motion")) {
      setDir("up");
      return;
    }

    let last = window.scrollY;
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      // Perto do topo: sempre visível.
      if (y < 24) {
        setDir("up");
      } else if (Math.abs(y - last) >= threshold) {
        setDir(y > last ? "down" : "up");
      }
      last = y;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return dir;
}
