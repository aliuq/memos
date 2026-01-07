/**
 * @description A cache to store media resolutions to avoid redundant calculations.
 */
import { useState, useEffect, useCallback } from "react";
import { ImageResolution, Orientation, VideoResolution, ResourceResolution } from "../types";

// LRU cache strategy: max 100 items to avoid unlimited memory growth
const MAX_CACHE_SIZE = 100;
const mediaResolutionCache = new Map<string, ResourceResolution>();
const cacheAccessOrder: string[] = []; // Track access order for LRU

/**
 * Add to cache and apply LRU strategy
 */
function addToCache(key: string, value: ResourceResolution) {
  // If exists, remove old access record first
  if (mediaResolutionCache.has(key)) {
    const index = cacheAccessOrder.indexOf(key);
    if (index > -1) {
      cacheAccessOrder.splice(index, 1);
    }
  }

  // Add new item
  mediaResolutionCache.set(key, value);
  cacheAccessOrder.push(key);

  // If exceeds max cache size, remove least recently used item
  if (mediaResolutionCache.size > MAX_CACHE_SIZE) {
    const oldestKey = cacheAccessOrder.shift();
    if (oldestKey) {
      mediaResolutionCache.delete(oldestKey);
    }
  }
}

/**
 * Get from cache and update access order
 */
function getFromCache(key: string): ResourceResolution | undefined {
  const value = mediaResolutionCache.get(key);
  if (value) {
    // Update access order: move to end
    const index = cacheAccessOrder.indexOf(key);
    if (index > -1) {
      cacheAccessOrder.splice(index, 1);
      cacheAccessOrder.push(key);
    }
  }
  return value;
}

interface UseMediaResolutionOptions {
  /**
   * Custom cache key. If not provided, the URL will be used as the key
   */
  key?: string;
  /**
   * Media type: 'image' or 'video'
   * @default "image"
   */
  type?: "image" | "video";
  /**
   * Image load timeout in milliseconds (default: 5000ms)
   */
  imageTimeout?: number;
  /**
   * Video load timeout in milliseconds (default: 10000ms)
   */
  videoTimeout?: number;
  /**
   * Video thumbnail capture time in seconds. Set to null to skip thumbnail generation (default: 0.5s)
   */
  seekTime?: number | null;
}

interface UseMediaResolutionResult {
  resolution: ResourceResolution | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for getting media (image/video) resolution with caching support
 * @param src - Media URL
 * @param options - Configuration options
 * @returns Media resolution, loading state, error, and refetch function
 *
 * @example
 * ```typescript
 * // Use URL as cache key
 * const { resolution, loading, error, refetch } = useMediaResolution(imageUrl, {
 *   type: "image",
 *   imageTimeout: 5000,
 * });
 *
 * // Use custom key as cache key
 * const { resolution, loading, error } = useMediaResolution(videoUrl, {
 *   type: "video",
 *   key: "my-custom-key",
 *   seekTime: 1.0, // Capture thumbnail at 1 second
 *   videoTimeout: 10000,
 * });
 * ```
 */
export function useMediaResolution(src: string, options: UseMediaResolutionOptions): UseMediaResolutionResult {
  const { key, type = "image", imageTimeout = 5000, videoTimeout = 10000, seekTime = 0.5 } = options;
  const cacheKey = key || src;

  const [resolution, setResolution] = useState<ResourceResolution | null>(() => {
    // Try to get from cache
    return getFromCache(cacheKey) || null;
  });
  const [loading, setLoading] = useState<boolean>(!mediaResolutionCache.has(cacheKey));
  const [error, setError] = useState<Error | null>(null);

  const fetchResolution = useCallback(async () => {
    // If cached, return immediately
    const cached = getFromCache(cacheKey);
    if (cached) {
      setResolution(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result: ResourceResolution;

      if (type === "image") {
        const imgRes = await getImageResolution(src, imageTimeout);
        result = { type: "image", ...imgRes } as ImageResolution;
      } else if (type === "video") {
        const vidRes = await getVideoResolution(src, seekTime, videoTimeout);
        result = { type: "video", ...vidRes } as VideoResolution;
      } else {
        throw new Error(`Unsupported media type: ${type}`);
      }

      // Cache the result
      addToCache(cacheKey, result);
      setResolution(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [src, cacheKey, type, imageTimeout, videoTimeout, seekTime]);

  useEffect(() => {
    fetchResolution();
  }, [fetchResolution]);

  return {
    resolution,
    loading,
    error,
    refetch: fetchResolution,
  };
}

/**
 * Get orientation based on width and height
 */
export function getOrientation(width: number, height: number): Orientation {
  if (width > height) return Orientation.LANDSCAPE;
  if (width < height) return Orientation.PORTRAIT;
  return Orientation.SQUARE;
}

/**
 * Calculate resolution info from a loaded image element
 * @param img - Loaded image element
 * @returns Image resolution info
 */
export function calculateImageResolution(img: HTMLImageElement): Omit<ImageResolution, "type"> {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const displayHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
  const displayWidth = Math.floor((width / height) * displayHeight);

  return { width, height, orientation: getOrientation(width, height), displayWidth, displayHeight };
}

/**
 * Calculate resolution info from a loaded video element
 * @param video - Loaded video element
 * @returns Video resolution info
 */
export function calculateVideoResolution(video: HTMLVideoElement): Omit<VideoResolution, "type"> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  const orientation = getOrientation(width, height);

  return { width, height, orientation };
}

/**
 * Generate thumbnail from video element
 * @param video - Video element
 * @param seekTime - Time to capture thumbnail (in seconds). If null, uses current time
 * @param quality - JPEG quality (default: 0.8)
 * @returns Promise with thumbnail base64 data
 */
export function generateVideoThumbnail(video: HTMLVideoElement, seekTime: number | null = null, quality: number = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const width = video.videoWidth;
    const height = video.videoHeight;

    // Validate video dimensions
    if (width <= 0 || height <= 0) {
      reject(new Error("Invalid video dimensions"));
      return;
    }

    let hasSeeked = false;

    /**
     * Capture current frame as thumbnail
     */
    const captureFrame = () => {
      if (hasSeeked) return;
      hasSeeked = true;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      try {
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, width, height);

        // Convert to base64 JPEG format
        const thumbnail = canvas.toDataURL("image/jpeg", quality);
        resolve(thumbnail);
      } catch (error) {
        reject(error);
      }
    };

    // If no seek needed, capture current frame directly
    if (isNil(seekTime)) {
      // Ensure video is ready
      if (video.readyState >= 2) {
        captureFrame();
      } else {
        video.onloadeddata = captureFrame;
      }
      return;
    }

    // Need to seek to specified time
    const videoDuration = video.duration || 0;
    if (!isFinite(videoDuration) || videoDuration <= 0) {
      reject(new Error("Invalid video duration"));
      return;
    }

    const targetTime = Math.min(Math.max(seekTime!, 0), videoDuration);

    // Listen for seeked event
    video.onseeked = captureFrame;

    // Listen for canplay event as fallback
    video.oncanplay = () => {
      if (!hasSeeked) {
        captureFrame();
      }
    };

    // Set video playback position to target time
    try {
      video.currentTime = targetTime;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Check if value is null or undefined
 */
function isNil(value: any): boolean {
  return value === null || value === undefined;
}

/**
 * Get image resolution and orientation from the image URL.
 * @param src - Image URL
 * @param timeout - Timeout in milliseconds (default: 5000ms)
 * @returns Promise with image resolution data
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
      img.src = ""; // Clean up reference
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

    // Set up timeout
    timeoutId = setTimeout(() => {
      rejectOnce(`Image resolution fetch timeout after ${timeout}ms: ${src}`);
    }, timeout);

    img.onload = () => {
      const resolution = calculateImageResolution(img);
      resolveOnce(resolution);
    };

    img.onerror = (event) => {
      // Provide more detailed error info
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

/**
 * Get video resolution, orientation, and thumbnail from video URL
 *
 * This function creates a hidden video element to load video metadata, extract width/height info,
 * and optionally capture a frame at the specified time as a thumbnail.
 *
 * @param src - Video file URL
 * @param seekTime - Time to capture thumbnail (in seconds). Set to null to skip thumbnail generation (default: 0.5s)
 * @param timeout - Timeout in milliseconds (default: 10000ms / 10s)
 * @returns Promise with video width, height, orientation, and optional thumbnail base64 data
 *
 * @example
 * ```typescript
 * // Get video resolution with thumbnail
 * const result = await getVideoResolution('video.mp4', 1.0);
 * console.log(result); // { width: 1920, height: 1080, orientation: 'landscape', thumbnail: 'data:image/jpeg;base64,...' }
 *
 * // Get resolution only, no thumbnail
 * const result = await getVideoResolution('video.mp4', null);
 * console.log(result); // { width: 1920, height: 1080, orientation: 'landscape' }
 * ```
 */
export function getVideoResolution(
  src: string,
  seekTime: number | null = 0.5,
  timeout = 10000,
): Promise<Omit<VideoResolution, "type"> & { thumbnail?: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");

    // Configure video element attributes
    video.preload = "metadata"; // Only load metadata, not full video
    video.src = src;
    video.crossOrigin = "anonymous"; // Allow CORS (for canvas capture)
    video.muted = true; // Muted
    video.playsInline = true; // Inline playback on mobile
    video.style.position = "fixed"; // Fixed position
    video.style.left = "-9999px"; // Move out of viewport
    video.style.top = "-9999px";

    // Append to DOM (some browsers require element to be in DOM for events)
    document.body.appendChild(video);

    // Flag to prevent multiple resolve/reject calls
    let isResolved = false;
    // Store timeout ID
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    /**
     * Cleanup function
     * - Clear timeout timer
     * - Remove all event listeners
     * - Remove video element from DOM
     * - Release video resources
     */
    const cleanup = () => {
      if (isResolved) return;
      isResolved = true;

      // Clear timeout timer
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // Remove event listeners
      video.onloadedmetadata = null;
      video.onerror = null;
      video.onseeked = null;
      video.oncanplay = null;

      // Stop playback and release resources
      video.pause();
      video.removeAttribute("src");
      video.load(); // Reset video element state

      // Remove from DOM
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
    };

    /**
     * Unified resolve handler, ensure called only once
     */
    const resolveOnce = (value: Omit<VideoResolution, "type"> & { thumbnail?: string }) => {
      if (!isResolved) {
        cleanup();
        resolve(value);
      }
    };

    /**
     * Unified reject handler, ensure called only once
     */
    const rejectOnce = (reason: string) => {
      if (!isResolved) {
        cleanup();
        reject(new Error(`${reason} - URL: ${src}`));
      }
    };

    // Set up timeout timer
    timeoutId = setTimeout(() => {
      rejectOnce(`Video load timed out after ${timeout}ms`);
    }, timeout);

    // Error handler: video load failed
    video.onerror = (event) => {
      let errorMessage = "Video load failed";

      // Try to get more detailed error info
      if (event instanceof ErrorEvent && event.message) {
        errorMessage += `: ${event.message}`;
      } else if (video.error) {
        const errorCode = video.error.code;
        const errorMessages: Record<number, string> = {
          1: "MEDIA_ERR_ABORTED - Load aborted",
          2: "MEDIA_ERR_NETWORK - Network error",
          3: "MEDIA_ERR_DECODE - Decode error",
          4: "MEDIA_ERR_SRC_NOT_SUPPORTED - Unsupported video format",
        };
        errorMessage += `: ${errorMessages[errorCode] || `Unknown error code ${errorCode}`}`;
      }

      rejectOnce(errorMessage);
    };

    // Metadata loaded
    video.onloadedmetadata = () => {
      const { width, height, orientation } = calculateVideoResolution(video);

      // Validate video dimensions
      if (width <= 0 || height <= 0) {
        rejectOnce("Invalid video dimensions");
        return;
      }

      // If no thumbnail generation needed, return resolution info directly
      if (isNil(seekTime)) {
        resolveOnce({ width, height, orientation });
        return;
      }

      // Calculate target time (ensure within video duration)
      const videoDuration = video.duration || 0;
      if (!isFinite(videoDuration) || videoDuration <= 0) {
        // If unable to get video duration, return without thumbnail
        resolveOnce({ width, height, orientation });
        return;
      }

      const targetTime = Math.min(Math.max(seekTime!, 0), videoDuration);
      let hasSeeked = false; // Prevent multiple triggers

      /**
       * Capture video frame as thumbnail
       */
      const captureFrame = () => {
        if (hasSeeked) return;
        hasSeeked = true;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // Unable to get canvas context, return without thumbnail
          resolveOnce({ width, height, orientation });
          return;
        }

        try {
          // Draw video frame to canvas
          ctx.drawImage(video, 0, 0, width, height);

          // Convert to base64 JPEG format (0.8 quality)
          const thumbnail = canvas.toDataURL("image/jpeg", 0.8);

          resolveOnce({ width, height, thumbnail, orientation });
        } catch (error) {
          // Screenshot failed (possibly CORS issue), return without thumbnail
          console.warn("Failed to capture video thumbnail:", error);
          resolveOnce({ width, height, orientation });
        }
      };

      // Listen for seeked event (triggered after seek completes)
      video.onseeked = captureFrame;

      // Listen for canplay event (triggered when video is ready to play)
      // Some browsers may not trigger seeked event, use canplay as fallback
      video.oncanplay = () => {
        if (!hasSeeked) {
          captureFrame();
        }
      };

      // Set video playback position to target time
      try {
        video.currentTime = targetTime;
      } catch (error) {
        // If setting currentTime fails, return without thumbnail
        console.warn("Failed to seek video:", error);
        resolveOnce({ width, height, orientation });
      }
    };
  });
}

/**
 * Clear specific cache item or all cache
 * @param key - Cache key to clear. If not provided, clears all cache
 */
export function clearMediaResolutionCache(key?: string): void {
  if (key) {
    mediaResolutionCache.delete(key);
  } else {
    mediaResolutionCache.clear();
  }
}

/**
 * Get current cache size
 */
export function getMediaResolutionCacheSize(): number {
  return mediaResolutionCache.size;
}
