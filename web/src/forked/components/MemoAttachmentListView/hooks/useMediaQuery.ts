/**
 * ref: https://github.com/usememos/memos/blob/ed66e0fec291c67fa75643d3148c6a0a6c141905/web/src/hooks/useMediaQuery.ts
 */
import { useEffect, useState } from "react";

type Breakpoint = "sm" | "md" | "lg";

const BREAKPOINTS: Record<Breakpoint, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
};

export const useMediaQuery = (breakpoint: Breakpoint): boolean => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(min-width: ${BREAKPOINTS[breakpoint]}px)`).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${BREAKPOINTS[breakpoint]}px)`);

    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [breakpoint]);

  return matches;
};
