import { Orientation } from "../types";

// Responsive display options
export interface ResponsiveShowOptions {
  /** Max width: 95% of viewport width */
  maxWidth?: number;
  /** Max height: 80% of viewport height (leave space for scrolling) */
  maxHeight?: number;
  /** Min width to prevent images from being too small */
  minWidth?: number;
  /** Display mode: 'fit' (full display) or 'cover' (fill and crop) */
  mode?: "fit" | "cover";
}

export interface ResponsiveSize {
  width: number;
  height: number;
}

/**
 * Calculate responsive display dimensions based on original image size
 * @param naturalWidth - Original image width
 * @param naturalHeight - Original image height
 * @param options - Optional config for max/min dimensions and mode (fit | cover)
 * @returns { width, height } - Calculated pixel dimensions (rounded to integers)
 */
export function responsiveShow(naturalWidth: number, naturalHeight: number, options: Partial<ResponsiveShowOptions> = {}): ResponsiveSize {
  // Default config (adjustable per project)
  const config: Required<ResponsiveShowOptions> = {
    maxWidth: (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth) * 0.95,
    maxHeight: (window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight) * 1,
    minWidth: 200,
    mode: "fit",
    ...options,
  };

  // Validate parameters: prevent invalid dimensions
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    const min = Math.round(config.minWidth);
    return { width: min, height: min };
  }

  const aspectRatio = naturalWidth / naturalHeight;
  let targetWidth = 0;
  let targetHeight = 0;

  if (config.mode === "cover") {
    // Cover mode: scale to fill container, may crop
    const containerRatio = config.maxWidth / config.maxHeight;
    if (containerRatio > aspectRatio) {
      // Wider container: fit to height
      targetHeight = config.maxHeight;
      targetWidth = targetHeight * aspectRatio;
    } else {
      // Taller or narrower container: fit to width
      targetWidth = config.maxWidth;
      targetHeight = targetWidth / aspectRatio;
    }
  } else {
    // Fit mode (default): full display, no cropping
    // Prioritize width, adjust by height if exceeds
    targetWidth = Math.min(naturalWidth, config.maxWidth);
    targetHeight = targetWidth / aspectRatio;

    // If height exceeds limit, recalculate based on height
    if (targetHeight > config.maxHeight) {
      targetHeight = config.maxHeight;
      targetWidth = targetHeight * aspectRatio;
    }

    // Ensure width doesn't exceed limit (prevent extreme wide images)
    if (targetWidth > config.maxWidth) {
      targetWidth = config.maxWidth;
      targetHeight = targetWidth / aspectRatio;
    }

    // Min size protection to prevent too small
    if (targetWidth < config.minWidth) {
      targetWidth = config.minWidth;
      targetHeight = targetWidth / aspectRatio;
    }
  }

  // Round to integer pixels
  return {
    width: Math.round(targetWidth),
    height: Math.round(targetHeight),
  };
}

interface PauseVideosOptions {
  id?: string;
  shadow?: boolean;
  dom?: boolean;
}

/**
 * Pause all videos in media-theme-mini components and regular DOM
 * @param id - Optional resource ID to exclude from pausing
 * @param shadow - Whether to pause videos in shadow DOM, default true
 * @param dom - Whether to pause videos in regular DOM, default true
 */
export function pauseVideos({ id, shadow = true, dom = true }: PauseVideosOptions = {}) {
  if (shadow) {
    const mediaThemeMiniSelector = id ? `media-theme-mini:not(#${id})` : "media-theme-mini";
    const mediaThemeMinis = document.querySelectorAll(mediaThemeMiniSelector);

    // Pause videos in shadow DOM
    mediaThemeMinis.forEach((element) => {
      const video = element.shadowRoot?.querySelector("video");
      if (video instanceof HTMLVideoElement) {
        video.pause();
      }
    });
  }

  if (dom) {
    // Pause videos in regular DOM
    const videos = document.querySelectorAll<HTMLVideoElement>("video");
    videos.forEach((video) => {
      video.pause();
    });
  }
}

/**
 * Get orientation based on width and height
 */
export function getOrientation(width: number, height: number): Orientation {
  if (width > height) return Orientation.LANDSCAPE;
  if (width < height) return Orientation.PORTRAIT;
  return Orientation.SQUARE;
}
