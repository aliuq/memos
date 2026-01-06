import { Resource } from "@/types/proto/api/v1/resource_service";
import { getResourceUrl } from "@/utils/resource";

/**
 * Generate a thumbnail image URL for the given resource.
 */
export function generateImageUrl(resource: Resource | string): string {
  const url = typeof resource === "string" ? resource : getResourceUrl(resource);
  const rawUrl = url.replace(/\?/g, "%3F").replace(/&/g, "%26");
  return `http://192.168.2.121:8089?url=${rawUrl}&w=200&fit=cover`;
}

// 响应式显示相关类型
export interface ResponsiveShowOptions {
  /** 最大宽度：视口宽度的95% */
  maxWidth?: number;
  /** 最大高度：视口高度的80%（留出空间滚动） */
  maxHeight?: number;
  /** 最小宽度，避免太小看不清 */
  minWidth?: number;
  /** 'fit'（完整显示） 或 'cover'（填充裁剪） */
  mode?: "fit" | "cover";
}

export interface ResponsiveSize {
  width: number;
  height: number;
}

/**
 * 根据图片原始尺寸，计算合理的响应式显示尺寸（像素）
 * - naturalWidth / naturalHeight: 图片原始尺寸
 * - options: 可选配置，包含最大/最小尺寸和模式（fit | cover）
 *
 * 返回值：
 * { width, height }：经过限制和最小尺寸保护后的像素尺寸（已四舍五入为整数）
 */
export function responsiveShow(naturalWidth: number, naturalHeight: number, options: Partial<ResponsiveShowOptions> = {}): ResponsiveSize {
  // 默认配置（可根据项目调整）
  const config: Required<ResponsiveShowOptions> = {
    maxWidth: (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth) * 0.95,
    maxHeight: (window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight) * 1,
    minWidth: 200,
    mode: "fit",
    ...options,
  };

  // 参数校验：防止非法尺寸
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    const min = Math.round(config.minWidth);
    return { width: min, height: min };
  }

  const aspectRatio = naturalWidth / naturalHeight; // 宽高比
  let targetWidth = 0;
  let targetHeight = 0;

  if (config.mode === "cover") {
    // cover 模式：放大以覆盖容器，可能会裁剪
    const containerRatio = config.maxWidth / config.maxHeight;
    if (containerRatio > aspectRatio) {
      // 容器更宽：以高度为准（高度填满容器）
      targetHeight = config.maxHeight;
      targetWidth = targetHeight * aspectRatio;
    } else {
      // 容器更高或更窄：以宽度为准（宽度填满容器）
      targetWidth = config.maxWidth;
      targetHeight = targetWidth / aspectRatio;
    }
  } else {
    // fit 模式（默认）：完整显示，不裁剪
    // 以宽度优先，若超高则以高度为准
    targetWidth = Math.min(naturalWidth, config.maxWidth);
    targetHeight = targetWidth / aspectRatio;

    // 如果高度超出限制，则以高度为准重新计算
    if (targetHeight > config.maxHeight) {
      targetHeight = config.maxHeight;
      targetWidth = targetHeight * aspectRatio;
    }

    // 再次确保不超过宽度限制（防止极端宽图）
    if (targetWidth > config.maxWidth) {
      targetWidth = config.maxWidth;
      targetHeight = targetWidth / aspectRatio;
    }

    // 最小尺寸保护，确保不会太小
    if (targetWidth < config.minWidth) {
      targetWidth = config.minWidth;
      targetHeight = targetWidth / aspectRatio;
    }
  }

  // 四舍五入取整（像素值），返回整数像素值
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
 * 暂停所有 media-theme-mini 组件中的视频播放，以及普通 DOM 中的视频播放
 * @param id 可选，指定资源 ID，暂停除该资源外的所有视频
 * @param shadow 是否暂停 shadow DOM 中的视频，默认 true
 * @param dom 是否暂停普通 DOM 中的视频，默认 true
 */
export function pauseVideos({ id, shadow = true, dom = true }: PauseVideosOptions = {}) {
  if (shadow) {
    const mediaThemeMiniSelector = id ? `media-theme-mini:not(#${id})` : "media-theme-mini";
    const mediaThemeMinis = document.querySelectorAll(mediaThemeMiniSelector);

    // shadow DOM 中的视频暂停
    mediaThemeMinis.forEach((element) => {
      const video = element.shadowRoot?.querySelector("video");
      if (video instanceof HTMLVideoElement) {
        video.pause();
      }
    });
  }

  if (dom) {
    // 普通 DOM 中的视频暂停
    const videos = document.querySelectorAll<HTMLVideoElement>("video");
    console.log("Pausing videos in DOM:", videos);
    videos.forEach((video) => {
      video.pause();
    });
  }
}
