import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWindowSize } from "@/hooks/useWindowSize";

export type Breakpoint = "xs" | "sm" | "md" | "lg";

export type ViewportGuardStatus = {
  id: string;
  label: string;
  width: number;
  height: number;
  overflowX: number;
  overflowY: number;
  outOfBounds: boolean;
  isOverlay: boolean;
  updatedAt: number;
};

export type ViewportContextValue = {
  width: number;
  height: number;
  resizeCount: number;
  isListening: boolean;
  breakpoint: Breakpoint;
  guards: Record<string, ViewportGuardStatus>;
  reportGuard: (status: ViewportGuardStatus) => void;
  removeGuard: (id: string) => void;
};

const ViewportContext = createContext<ViewportContextValue | null>(null);

function computeBreakpoint(width: number): Breakpoint {
  if (width < 380) return "xs";
  if (width < 640) return "sm";
  if (width < 1024) return "md";
  return "lg";
}

export function ViewportProvider({ children }: { children: ReactNode }) {
  const { width, height, resizeCount } = useWindowSize(150);
  const [guards, setGuards] = useState<Record<string, ViewportGuardStatus>>({});
  const listeningRef = useRef(true);

  const reportGuard = (status: ViewportGuardStatus) => {
    setGuards((prev) => {
      const existing = prev[status.id];
      if (
        existing &&
        existing.width === status.width &&
        existing.height === status.height &&
        existing.outOfBounds === status.outOfBounds &&
        existing.overflowX === status.overflowX &&
        existing.overflowY === status.overflowY
      ) {
        return prev;
      }
      return { ...prev, [status.id]: status };
    });
  };

  const removeGuard = (id: string) => {
    setGuards((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const value = useMemo<ViewportContextValue>(
    () => ({
      width,
      height,
      resizeCount,
      isListening: listeningRef.current && typeof window !== "undefined",
      breakpoint: computeBreakpoint(width || 0),
      guards,
      reportGuard,
      removeGuard,
    }),
    [width, height, resizeCount, guards],
  );

  // Expose global report accessor for console inspection
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as unknown as { getViewportReport?: () => unknown }).getViewportReport = () => ({
      width: value.width,
      height: value.height,
      resizeCount: value.resizeCount,
      isListening: value.isListening,
      breakpoint: value.breakpoint,
      guards: value.guards,
    });
  }, [value]);

  return <ViewportContext.Provider value={value}>{children}</ViewportContext.Provider>;
}

export function useViewport(): ViewportContextValue {
  const ctx = useContext(ViewportContext);
  if (!ctx) {
    // Fallback: safe defaults if provider missing
    return {
      width: typeof window !== "undefined" ? window.innerWidth : 0,
      height: typeof window !== "undefined" ? window.innerHeight : 0,
      resizeCount: 0,
      isListening: false,
      breakpoint: "lg",
      guards: {},
      reportGuard: () => {},
      removeGuard: () => {},
    };
  }
  return ctx;
}
