import { memo, useState, useRef, useEffect, useCallback } from "react";

interface LazyImageProps {
  src: string;
  alt?: string;
  className?: string;
  type?: "image" | "video";
  onLoad?: () => void;
  onClick?: () => void;
}

export const LazyImage = memo(({ src, alt = "", className = "", type = "image", onLoad, onClick }: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);

  // 重置状态当 src 改变时
  useEffect(() => {
    setIsLoaded(false);
    setError(false);
    setShouldLoad(false);
  }, [src]);

  useEffect(() => {
    // 如果没有 src，不需要继续
    if (!src) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "100px", // 增加预加载距离
        threshold: 0.01,
      },
    );

    if (placeholderRef.current) {
      observer.observe(placeholderRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setError(true);
  }, []);

  const handleRetry = useCallback(() => {
    setError(false);
    if (imgRef.current) {
      imgRef.current.src = src;
    }
  }, [src]);

  return (
    <div ref={placeholderRef} className={`relative ${className} overflow-hidden`}>
      {!isLoaded && !error && (
        <div className="absolute inset-0 bg-gray-100 dark:bg-zinc-800">
          <div className="absolute inset-0 animate-pulse bg-gray-200 dark:bg-zinc-700" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-zinc-800">
          <span className="text-red-500 mb-2">加载失败</span>
          <button
            onClick={handleRetry}
            className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-zinc-700 rounded hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors"
          >
            重试
          </button>
        </div>
      )}

      {shouldLoad && !error && src && (
        <img
          ref={imgRef}
          className={`size-full ${type === "image" ? "object-cover" : "object-contain"} 
            transition-all duration-500 ${isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          onClick={onClick}
        />
      )}
    </div>
  );
});

LazyImage.displayName = "LazyImage";
