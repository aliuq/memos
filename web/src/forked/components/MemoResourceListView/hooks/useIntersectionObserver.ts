import { useEffect, useRef, useState, useCallback } from "react";

export interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  /**
   * Trigger only once (stop observing after element enters viewport)
   * @default false
   */
  once?: boolean;
  /**
   * Enable observation
   * @default true
   */
  enabled?: boolean;
  /**
   * Animation delay in milliseconds
   * Used to delay animation state trigger after element enters viewport
   * @default 0
   */
  animationDelay?: number;
  /**
   * Callback when entering viewport
   */
  onIntersecting?: (entry: IntersectionObserverEntry) => void;
  /**
   * Callback when leaving viewport
   */
  onLeaving?: (entry: IntersectionObserverEntry) => void;
}

/**
 * High-performance IntersectionObserver Hook
 * Monitors whether element enters viewport, supports entrance animations
 *
 * @example
 * ```tsx
 * // Basic usage
 * const { ref, isIntersecting } = useIntersectionObserver({
 *   threshold: 0.1,
 *   rootMargin: '100px',
 * });
 *
 * return <div ref={ref}>{isIntersecting ? 'Visible' : 'Hidden'}</div>
 * ```
 *
 * @example
 * ```tsx
 * // With entrance animation
 * const { ref, hasEntered } = useIntersectionObserver({
 *   once: true,
 *   animationDelay: 50,
 * });
 *
 * return (
 *   <div
 *     ref={ref}
 *     className={`transition-all duration-500 ${
 *       hasEntered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
 *     }`}
 *   >
 *     Content
 *   </div>
 * );
 * ```
 */
export function useIntersectionObserver<T extends HTMLElement = HTMLElement>(options: UseIntersectionObserverOptions = {}) {
  const {
    threshold = 0.01,
    root = null,
    rootMargin = "100px",
    once = false,
    enabled = true,
    animationDelay = 0,
    onIntersecting,
    onLeaving,
  } = options;

  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const elementRef = useRef<T | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const hasIntersectedRef = useRef(false);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Optimize callback with useCallback
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;

      setEntry(entry);
      setIsIntersecting(entry.isIntersecting);

      if (entry.isIntersecting) {
        hasIntersectedRef.current = true;
        onIntersecting?.(entry);

        // Delay entrance animation trigger
        if (animationDelay > 0) {
          animationTimerRef.current = setTimeout(() => {
            setHasEntered(true);
          }, animationDelay);
        } else {
          setHasEntered(true);
        }

        // If only need to trigger once, immediately disconnect observer
        if (once && observerRef.current && elementRef.current) {
          observerRef.current.unobserve(elementRef.current);
        }
      } else if (hasIntersectedRef.current) {
        onLeaving?.(entry);
      }
    },
    [once, animationDelay, onIntersecting, onLeaving],
  );

  useEffect(() => {
    // Return early if not enabled or IntersectionObserver not supported
    if (!enabled || typeof IntersectionObserver === "undefined") {
      return;
    }

    const element = elementRef.current;
    if (!element) {
      return;
    }

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(handleIntersect, {
      threshold,
      root,
      rootMargin,
    });

    observerRef.current.observe(element);

    // Cleanup function
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      // Clean up animation timer
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
    };
  }, [enabled, threshold, root, rootMargin, handleIntersect]);

  // Provide reset function to restart observation
  const reset = useCallback(() => {
    hasIntersectedRef.current = false;
    setIsIntersecting(false);
    setHasEntered(false);
    setEntry(null);

    // Clean up animation timer
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }

    if (observerRef.current && elementRef.current) {
      observerRef.current.observe(elementRef.current);
    }
  }, []);

  return {
    ref: elementRef,
    isIntersecting,
    hasEntered,
    entry,
    reset,
  };
}
