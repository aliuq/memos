import { useEffect, useRef, useState, useCallback } from "react";

export interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  /**
   * 是否只触发一次（元素进入视图后立即停止观察）
   * @default false
   */
  once?: boolean;
  /**
   * 是否启用观察
   * @default true
   */
  enabled?: boolean;
  /**
   * 入场动画延迟（毫秒）
   * 用于在元素进入视图后延迟触发动画状态
   * @default 0
   */
  animationDelay?: number;
  /**
   * 进入视图时的回调
   */
  onIntersecting?: (entry: IntersectionObserverEntry) => void;
  /**
   * 离开视图时的回调
   */
  onLeaving?: (entry: IntersectionObserverEntry) => void;
}

/**
 * 高性能的 IntersectionObserver Hook
 * 用于监听元素是否进入视口，支持入场动画
 *
 * @example
 * ```tsx
 * // 基础用法
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
 * // 带入场动画
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
    threshold = 0,
    root = null,
    rootMargin = "0px",
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

  // 使用 useCallback 优化回调函数
  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;

      setEntry(entry);
      setIsIntersecting(entry.isIntersecting);

      if (entry.isIntersecting) {
        hasIntersectedRef.current = true;
        onIntersecting?.(entry);

        // 延迟触发入场动画状态
        if (animationDelay > 0) {
          animationTimerRef.current = setTimeout(() => {
            setHasEntered(true);
          }, animationDelay);
        } else {
          setHasEntered(true);
        }

        // 如果只需要触发一次，立即断开观察
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
    // 如果未启用或不支持 IntersectionObserver，直接返回
    if (!enabled || typeof IntersectionObserver === "undefined") {
      return;
    }

    const element = elementRef.current;
    if (!element) {
      return;
    }

    // 清理之前的 observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // 创建新的 observer
    observerRef.current = new IntersectionObserver(handleIntersect, {
      threshold,
      root,
      rootMargin,
    });

    observerRef.current.observe(element);

    // 清理函数
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      // 清理动画定时器
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
    };
  }, [enabled, threshold, root, rootMargin, handleIntersect]);

  // 提供重置函数，用于重新开始观察
  const reset = useCallback(() => {
    hasIntersectedRef.current = false;
    setIsIntersecting(false);
    setHasEntered(false);
    setEntry(null);

    // 清理动画定时器
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
