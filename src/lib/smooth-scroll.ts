/**
 * Lightweight smooth-scroll for desktop wheel + keyboard.
 * - No dependency
 * - Skips touch / coarse pointer (nativa no mobile)
 * - Respeita prefers-reduced-motion e html.reduce-motion
 * - Ignora scroll dentro de elementos com [data-lenis-prevent] ou dentro de
 *   containers roláveis (sheets, ScrollArea, chat, modais)
 */

const KEY_STEP = 40; // px por seta
const PAGE_RATIO = 0.9; // fração da viewport para PageUp/PageDown/Espaço
const EASING = 0.14; // 0..1 — mais alto = mais rápido

let installed = false;
let target = 0;
let current = 0;
let animating = false;
let rafId = 0;

function isReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.classList.contains("reduce-motion")) return true;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.matchMedia("(hover: none), (pointer: coarse)").matches;
  } catch {
    return false;
  }
}

function findScrollableAncestor(el: Element | null): HTMLElement | null {
  let node: Element | null = el;
  while (node && node !== document.body && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      if (node.hasAttribute("data-lenis-prevent")) return node;
      const style = getComputedStyle(node);
      const oy = style.overflowY;
      if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) {
        return node;
      }
    }
    node = node.parentElement;
  }
  return null;
}

function canElementScroll(el: HTMLElement, delta: number): boolean {
  if (el.hasAttribute("data-lenis-prevent")) return true;
  if (delta > 0) {
    return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
  }
  return el.scrollTop > 0;
}

function maxScroll(): number {
  return Math.max(
    0,
    (document.scrollingElement?.scrollHeight ?? document.body.scrollHeight) - window.innerHeight,
  );
}

function tick() {
  const diff = target - current;
  if (Math.abs(diff) < 0.5) {
    current = target;
    window.scrollTo(0, current);
    animating = false;
    return;
  }
  current += diff * EASING;
  window.scrollTo(0, current);
  rafId = requestAnimationFrame(tick);
}

function scheduleTo(next: number) {
  target = Math.max(0, Math.min(maxScroll(), next));
  if (!animating) {
    current = window.scrollY;
    animating = true;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }
}

function onWheel(e: WheelEvent) {
  if (isReducedMotion()) return;
  if (e.ctrlKey || e.metaKey) return; // zoom
  const inner = findScrollableAncestor(e.target as Element);
  if (inner && canElementScroll(inner, e.deltaY)) return;
  e.preventDefault();
  // Normaliza delta (line=16, page=innerHeight)
  let delta = e.deltaY;
  if (e.deltaMode === 1) delta *= 16;
  else if (e.deltaMode === 2) delta *= window.innerHeight;
  const base = animating ? target : window.scrollY;
  scheduleTo(base + delta);
}

function onKeyDown(e: KeyboardEvent) {
  if (isReducedMotion()) return;
  const t = e.target as HTMLElement | null;
  if (t) {
    const tag = t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return;
  }
  const inner = findScrollableAncestor(t);
  let delta = 0;
  switch (e.key) {
    case "ArrowDown":
      delta = KEY_STEP;
      break;
    case "ArrowUp":
      delta = -KEY_STEP;
      break;
    case "PageDown":
      delta = window.innerHeight * PAGE_RATIO;
      break;
    case "PageUp":
      delta = -window.innerHeight * PAGE_RATIO;
      break;
    case " ": // Space
      delta = window.innerHeight * PAGE_RATIO * (e.shiftKey ? -1 : 1);
      break;
    case "Home":
      e.preventDefault();
      scheduleTo(0);
      return;
    case "End":
      e.preventDefault();
      scheduleTo(maxScroll());
      return;
    default:
      return;
  }
  if (inner && canElementScroll(inner, delta)) return;
  e.preventDefault();
  const base = animating ? target : window.scrollY;
  scheduleTo(base + delta);
}

export function installSmoothScroll(): () => void {
  if (installed || typeof window === "undefined") return () => {};
  if (isCoarsePointer()) return () => {};
  installed = true;
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKeyDown, { passive: false });
  return () => {
    installed = false;
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("keydown", onKeyDown);
    cancelAnimationFrame(rafId);
    animating = false;
  };
}

export function jumpToTop() {
  if (typeof window === "undefined") return;
  cancelAnimationFrame(rafId);
  animating = false;
  target = 0;
  current = 0;
  window.scrollTo(0, 0);
}
