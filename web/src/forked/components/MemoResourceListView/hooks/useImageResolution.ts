/**
 * @description Image resolution utilities and React hook
 */
import { useState, useEffect, useCallback } from "react";
import { ImageResolution, Orientation } from "../types";
import { getOrientation } from "../utils";
import { addToCache, getFromCache, hasCache } from "./mediaCache";

/**
 * Calculate resolution info from a loaded image element
 */
export function calculateImageResolution(img: HTMLImageElement): Omit<ImageResolution, "type"> {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height) {
    return { width: 0, height: 0, orientation: Orientation.SQUARE, displayWidth: 0, displayHeight: 0 };
  }
  const displayHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
  const displayWidth = Math.floor((width / height) * displayHeight);

  return { width, height, orientation: getOrientation(width, height), displayWidth, displayHeight };
}

/**
 * Get image resolution and orientation from the image URL.
 * @param src - Image URL
 * @param timeout - Timeout in milliseconds (default: 5000ms)
 */
export function getImageResolution(src: string, timeout = 5000): Promise<Omit<ImageResolution, "type">> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isResolved = false;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      img.onload = null;
      img.onerror = null;
      img.src = "";
    };

    const resolveOnce = (value: Omit<ImageResolution, "type">) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(value);
      }
    };

    const rejectOnce = (reason: string) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        reject(new Error(reason));
      }
    };

    timeoutId = setTimeout(() => {
      rejectOnce(`Image resolution fetch timeout after ${timeout}ms: ${src}`);
    }, timeout);

    img.onload = () => {
      const resolution = calculateImageResolution(img);
      resolveOnce(resolution);
    };

    img.onerror = (event) => {
      let errorMessage = "Image resolution fetch failed";

      if (event instanceof ErrorEvent && event.message) {
        errorMessage += `: ${event.message}`;
      } else if (typeof event === "string") {
        errorMessage += `: ${event}`;
      }

      errorMessage += ` - URL: ${src}`;
      rejectOnce(errorMessage);
    };

    img.src = src;
  });
}

interface UseImageResolutionOptions {
  /** Custom cache key. If not provided, the URL will be used as the key */
  key?: string;
  /**
   * Image load timeout in milliseconds
   * @default 5000
   */
  timeout?: number;
}

interface UseImageResolutionResult {
  resolution: ImageResolution | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for getting image resolution with caching support
 * @param src - Image URL
 * @param options - Configuration options
 * @returns Image resolution, loading state, error, and refresh function
 *
 * @example
 * ```typescript
 * const { resolution, loading, error, refresh } = useImageResolution(imageUrl, {
 *   timeout: 5000,
 * });
 *
 * // Use custom cache key
 * const { resolution, loading, error } = useImageResolution(imageUrl, {
 *   key: "my-custom-key",
 * });
 * ```
 */
export function useImageResolution(src: string, options: UseImageResolutionOptions = {}): UseImageResolutionResult {
  const { key, timeout = 5000 } = options;
  const cacheKey = key || src;

  const [resolution, setResolution] = useState<ImageResolution | null>(() => {
    // Try to get from cache
    const cached = getFromCache(cacheKey);
    return cached && cached.type === "image" ? (cached as ImageResolution) : null;
  });
  const [loading, setLoading] = useState<boolean>(!hasCache(cacheKey));
  const [error, setError] = useState<Error | null>(null);

  const fetchResolution = useCallback(async () => {
    // If cached, return immediately
    const cached = getFromCache(cacheKey);
    if (cached && cached.type === "image") {
      setResolution(cached as ImageResolution);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const imgRes = await getImageResolution(src, timeout);
      const result = { type: "image", ...imgRes } as ImageResolution;

      // Cache the result
      addToCache(cacheKey, result);
      setResolution(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [src, cacheKey, timeout]);

  useEffect(() => {
    fetchResolution();
  }, [fetchResolution]);

  return {
    resolution,
    loading,
    error,
    refresh: fetchResolution,
  };
}
