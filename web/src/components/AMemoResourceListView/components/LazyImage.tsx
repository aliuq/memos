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
  const imgRef = useRef<HTMLImageElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
        rootMargin: "50px",
        threshold: 0.01,
      },
    );

    if (placeholderRef.current) {
      observer.observe(placeholderRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  return (
    <div ref={placeholderRef} className={`relative ${className}`}>
      {/* 占位元素始终显示，直到图片加载完成 */}
      {!isLoaded && <div className="absolute inset-0 bg-gray-100 dark:bg-zinc-800 animate-pulse" />}
      {shouldLoad && (
        <img
          ref={imgRef}
          className={`size-full ${type === "image" ? "object-cover" : "object-contain"} 
            transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"}`}
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onClick={onClick}
        />
      )}
    </div>
  );
});

LazyImage.displayName = "LazyImage";
