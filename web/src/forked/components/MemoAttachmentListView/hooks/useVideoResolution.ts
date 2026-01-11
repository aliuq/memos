/**
 * @description Video resolution utilities and React hook with user interaction handling
 */
import { useState, useEffect, useCallback } from "react";
import { VideoResolution } from "../types";
import { getOrientation } from "../utils";
import { addToCache, getFromCache, hasCache } from "./mediaCache";

interface SetupVideoInteractionOptions {
  /**
   * Force re-setup even if already initialized
   * @default false
   */
  force?: boolean;
  /**
   * Auto-detect if current device needs interaction handling
   * @default true
   */
  autoDetect?: boolean;
  /**
   * Attribute key for listing pending interaction videos
   * @default 'data-pending-interaction'
   */
  key?: string;
}

interface GetVideoResolutionOptions {
  /**
   * Time to capture thumbnail (in seconds). Set to null to skip thumbnail generation
   * @default 0.5
   */
  seekTime?: number | null;
  /**
   * Timeout in milliseconds
   * @default 10000
   */
  timeout?: number;
  /**
   * Whether to enable user interaction handler
   * @default true
   */
  enableInteractionHandler?: boolean;
  /**
   * Attribute key for listing pending interaction videos
   * @default 'data-pending-interaction'
   */
  key?: string;
}

type UseVideoResolutionOptions = Omit<GetVideoResolutionOptions, "key"> & {
  /**
   * Custom cache key. If not provided, the URL will be used as the key
   */
  key?: string;
  /**
   * Attribute key for listing pending interaction videos
   * @default 'data-pending-interaction'
   */
  attributeKey?: GetVideoResolutionOptions["key"];
};

interface UseVideoResolutionResult {
  resolution: VideoResolution | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Check if value is null or undefined
 */
function isNil(value: any): boolean {
  return value === null || value === undefined;
}

/**
 * Calculate resolution info from a loaded video element
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
 * @param timeout - Timeout in milliseconds (default: 5000ms)
 * @returns Promise with thumbnail base64 data
 */
export function generateVideoThumbnail(
  video: HTMLVideoElement,
  seekTime: number | null = 0.5,
  quality: number = 0.8,
  timeout: number = 5000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const width = video.videoWidth;
    const height = video.videoHeight;

    // Validate video dimensions
    if (width <= 0 || height <= 0) {
      reject(new Error("Invalid video dimensions"));
      return;
    }

    let hasSeeked = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isResolved = false;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      video.onseeked = null;
      video.oncanplay = null;
      video.onloadeddata = null;
    };

    const resolveOnce = (thumbnail: string) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(thumbnail);
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
      rejectOnce(`Video thumbnail generation timeout after ${timeout}ms`);
    }, timeout);

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
        rejectOnce("Failed to get canvas context");
        return;
      }

      try {
        ctx.drawImage(video, 0, 0, width, height);
        const thumbnail = canvas.toDataURL("image/jpeg", quality);
        resolveOnce(thumbnail);
      } catch (error) {
        rejectOnce(error instanceof Error ? error.message : String(error));
      }
    };

    if (isNil(seekTime)) {
      if (video.readyState >= 2) {
        captureFrame();
      } else {
        video.onloadeddata = captureFrame;
      }
      return;
    }

    const videoDuration = video.duration || 0;
    if (!isFinite(videoDuration) || videoDuration <= 0) {
      rejectOnce("Invalid video duration");
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
      rejectOnce(error instanceof Error ? error.message : String(error));
    }
  });
}

// Global flag to track if we've already set up the video interaction listener
let interactionListenerSetup = false;

/**
 * Setup user interaction handler for video elements that require user interaction to play.
 * This is necessary for mobile browsers (especially iOS) that block autoplay without user interaction.
 *
 * This function sets up global event listeners (click, scroll, touchstart) that will attempt to
 * play all pending video elements marked with 'data-pending-interaction' attribute on first interaction.
 *
 * @example
 * ```typescript
 * // Setup interaction handler at app initialization
 * setupVideoInteractionHandler();
 *
 * // Force re-setup (useful for SPA route changes)
 * setupVideoInteractionHandler({ force: true });
 *
 * // Setup without auto-detection (always setup)
 * setupVideoInteractionHandler({ autoDetect: false });
 * ```
 */
export function setupVideoInteractionHandler(options: SetupVideoInteractionOptions = {}): boolean {
  const { force = false, autoDetect = true, key = "data-pending-interaction" } = options;

  // If already set up and not forcing, skip
  if (interactionListenerSetup && !force) {
    return false;
  }

  // Auto-detect if current device needs interaction handling
  // This includes iOS, some Android browsers, and other mobile browsers
  if (autoDetect) {
    const isMobile = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      return false;
    }
  }

  // Remove existing listeners if forcing re-setup
  if (force && interactionListenerSetup) {
    window.removeEventListener("click", handleInteraction, { capture: true } as any);
    window.removeEventListener("scroll", handleInteraction, { capture: true } as any);
    window.removeEventListener("touchstart", handleInteraction, { capture: true } as any);
  }

  interactionListenerSetup = true;

  function handleInteraction() {
    const videos = document.querySelectorAll(`video[${key}]`);
    videos.forEach((v) => {
      const videoEl = v as HTMLVideoElement;
      videoEl
        .play()
        .then(() => {
          // Pause immediately after play succeeds
          // The purpose is to trigger metadata loading, not actually play the video
          videoEl.pause();
          videoEl.currentTime = 0; // Reset to start
        })
        .catch(() => {
          // Ignore play errors - metadata might still load even if play fails
        });
      videoEl.removeAttribute(key);
    });

    // Remove listeners after first interaction
    window.removeEventListener("click", handleInteraction, { capture: true } as any);
    window.removeEventListener("scroll", handleInteraction, { capture: true, passive: true } as any);
    window.removeEventListener("touchstart", handleInteraction, { capture: true, passive: true } as any);

    // Reset flag to allow future setup if needed
    interactionListenerSetup = false;
  }

  // Listen to multiple interaction events
  window.addEventListener("click", handleInteraction, { capture: true, once: true });
  window.addEventListener("scroll", handleInteraction, { capture: true, once: true, passive: true });
  window.addEventListener("touchstart", handleInteraction, { capture: true, once: true, passive: true });

  return true;
}

/**
 * Reset the video interaction handler state
 * Useful for testing or when you need to re-initialize
 */
export function resetVideoInteractionHandler(): void {
  interactionListenerSetup = false;
}

/**
 * Get video resolution, orientation, and thumbnail from video URL
 *
 * This function creates a hidden video element to load video metadata, extract width/height info,
 * and optionally capture a frame at the specified time as a thumbnail.
 *
 * For devices that require user interaction for video playback, this function will set up
 * a one-time global interaction listener to trigger video.play() on first user interaction,
 * allowing metadata to load.
 *
 * @param src - Video file URL
 * @param seekTime - Time to capture thumbnail (in seconds). Set to null to skip thumbnail generation (default: 0.5s)
 * @param timeout - Timeout in milliseconds (default: 10000ms / 10s)
 * @param enableInteractionHandler - Whether to enable user interaction handler (default: true)
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
 *
 * // Disable interaction handler (if you've set it up globally)
 * const result = await getVideoResolution('video.mp4', 0.5, 10000, false);
 * ```
 */
export function getVideoResolution(src: string, options: GetVideoResolutionOptions = {}): Promise<Omit<VideoResolution, "type">> {
  return new Promise((resolve, reject) => {
    const { seekTime = 0.5, timeout = 10000, enableInteractionHandler = true, key = "data-pending-interaction" } = options;
    const video = document.createElement("video");
    const needsInteraction = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);

    video.preload = "metadata";
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.style.position = "fixed";
    video.style.left = "-9999px";
    video.style.top = "-9999px";

    document.body.appendChild(video);

    // Flag to prevent multiple resolve/reject calls
    let isResolved = false;
    // Store timeout ID
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

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
      video.onloadstart = null;

      // Remove pending interaction marker
      if (video.hasAttribute(key)) {
        video.removeAttribute(key);
      }

      // Stop playback and release attachments
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

    // Set up interaction handler if needed
    if (needsInteraction && enableInteractionHandler) {
      setupVideoInteractionHandler({ key });
      video.setAttribute(key, "true");
    }

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
          ctx.drawImage(video, 0, 0, width, height);
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

    // For devices that need interaction, try to play video on loadstart to trigger metadata loading
    if (needsInteraction) {
      video.onloadstart = () => {
        video.play().catch(() => {
          // Play might fail without user interaction, but that's ok
          // The global interaction listener will retry
        });
      };
    }

    video.src = src;
  });
}

/**
 * Hook for getting video resolution with caching support
 *
 * @example
 * ```typescript
 * const { resolution, loading, error } = useVideoResolution(videoUrl, {
 *   seekTime: 1.0, // Capture thumbnail at 1 second
 *   timeout: 10000,
 * });
 *
 * // Use custom cache key
 * const { resolution, loading, error, refresh } = useVideoResolution(videoUrl, {
 *   key: "my-custom-key",
 * });
 *
 * // Disable interaction handler (if set up globally)
 * const { resolution } = useVideoResolution(videoUrl, {
 *   enableInteractionHandler: false,
 * });
 * ```
 */
export function useVideoResolution(src: string, options: UseVideoResolutionOptions = {}): UseVideoResolutionResult {
  const { key, timeout = 10000, seekTime = 0.5, enableInteractionHandler = true } = options;
  const cacheKey = key || src;

  const [resolution, setResolution] = useState<VideoResolution | null>(() => {
    // Try to get from cache
    const cached = getFromCache(cacheKey);
    return cached && cached.type === "video" ? (cached as VideoResolution) : null;
  });
  const [loading, setLoading] = useState<boolean>(!hasCache(cacheKey));
  const [error, setError] = useState<Error | null>(null);

  const fetchResolution = useCallback(async () => {
    // If cached, return immediately
    const cached = getFromCache(cacheKey);
    if (cached && cached.type === "video") {
      setResolution(cached as VideoResolution);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const vidRes = await getVideoResolution(src, { seekTime, timeout, enableInteractionHandler });
      const result = { type: "video", ...vidRes } as VideoResolution;

      // Cache the result
      addToCache(cacheKey, result);
      setResolution(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [src, cacheKey, timeout, seekTime, enableInteractionHandler]);

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
