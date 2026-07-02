import { useEffect, useRef, useState } from "react";

export type WindowSize = {
  width: number;
  height: number;
  resizeCount: number;
};

const SSR_SIZE: WindowSize = { width: 0, height: 0, resizeCount: 0 };

function readSize(count: number): WindowSize {
  if (typeof window === "undefined") return SSR_SIZE;
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    resizeCount: count,
  };
}

export function useWindowSize(debounceMs: number = 150): WindowSize {
  const [size, setSize] = useState<WindowSize>(() => readSize(0));
  const countRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Sync on mount (SSR hydration safety)
    setSize(readSize(countRef.current));

    const onResize = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        countRef.current += 1;
        setSize(readSize(countRef.current));
      }, debounceMs);
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [debounceMs]);

  return size;
}
