/**
 * @description A cache to store media resolutions to avoid redundant calculations.
 */
import { useState, useEffect, useCallback } from "react";
import { ImageResolution, Orientation, VideoResolution, ResourceResolution } from "../types";

const mediaResolutionCache = new Map<string, ResourceResolution>();

interface UseMediaResolutionOptions {
  /**
   * 自定义缓存 key，如果不提供则使用 url 作为 key
   */
  key?: string;
  /**
   * 媒体类型：'image' 或 'video'
   * @default "image"
   */
  type?: "image" | "video";
  /**
   * 图片加载超时时间（毫秒），默认 5000ms
   */
  imageTimeout?: number;
  /**
   * 视频加载超时时间（毫秒），默认 10000ms
   */
  videoTimeout?: number;
  /**
   * 视频缩略图捕获时间点（秒），设置为 null 则不生成缩略图，默认 0.5 秒
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
 * // 使用 URL 作为缓存 key
 * const { resolution, loading, error, refetch } = useMediaResolution(imageUrl, {
 *   type: "image",
 *   imageTimeout: 5000,
 * });
 *
 * // 使用自定义 key 作为缓存 key
 * const { resolution, loading, error } = useMediaResolution(videoUrl, {
 *   type: "video",
 *   key: "my-custom-key",
 *   seekTime: 1.0, // 在第 1 秒处捕获缩略图
 *   videoTimeout: 10000,
 * });
 * ```
 */
export function useMediaResolution(src: string, options: UseMediaResolutionOptions): UseMediaResolutionResult {
  const { key, type = "image", imageTimeout = 5000, videoTimeout = 10000, seekTime = 0.5 } = options;
  const cacheKey = key || src;

  const [resolution, setResolution] = useState<ResourceResolution | null>(() => {
    // 尝试从缓存中获取
    return mediaResolutionCache.get(cacheKey) || null;
  });
  const [loading, setLoading] = useState<boolean>(!mediaResolutionCache.has(cacheKey));
  const [error, setError] = useState<Error | null>(null);

  const fetchResolution = useCallback(async () => {
    // 如果已有缓存，直接返回
    const cached = mediaResolutionCache.get(cacheKey);
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
        result = { type: "image", ...imgRes };
      } else if (type === "video") {
        const vidRes = await getVideoResolution(src, seekTime, videoTimeout);
        result = { type: "video", ...vidRes };
      } else {
        throw new Error(`Unsupported media type: ${type}`);
      }

      // 缓存结果
      mediaResolutionCache.set(cacheKey, result);
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
      img.src = ""; // 清理引用
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

    // 设置超时
    timeoutId = setTimeout(() => {
      rejectOnce(`Image resolution fetch timeout after ${timeout}ms: ${src}`);
    }, timeout);

    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      // TODO：根据 ratio 计算更为合理的 displayWidth 和 displayHeight
      const displayHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
      const displayWidth = Math.floor((width / height) * displayHeight);

      resolveOnce({ width, height, orientation: getOrientation(width, height), displayWidth, displayHeight });
    };

    img.onerror = (event) => {
      // 提供更详细的错误信息
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
 * 从视频 URL 获取视频分辨率、方向和缩略图
 *
 * 该函数会创建一个隐藏的 video 元素来加载视频元数据，获取视频的宽高信息，
 * 并可选择性地在指定时间点捕获一帧作为缩略图。
 *
 * @param src - 视频文件的 URL 地址
 * @param seekTime - 捕获缩略图的时间点（秒），设置为 null 则不生成缩略图。默认 0.5 秒
 * @param timeout - 超时时间（毫秒），默认 10000ms（10秒）
 * @returns Promise，包含视频的宽度、高度、方向和可选的缩略图 base64 数据
 *
 * @example
 * ```typescript
 * // 获取视频分辨率和缩略图
 * const result = await getVideoResolution('video.mp4', 1.0);
 * console.log(result); // { width: 1920, height: 1080, orientation: 'landscape', thumbnail: 'data:image/jpeg;base64,...' }
 *
 * // 仅获取分辨率，不生成缩略图
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

    // 配置视频元素属性
    video.preload = "metadata"; // 只加载元数据，不加载完整视频
    video.src = src;
    video.crossOrigin = "anonymous"; // 允许跨域访问（用于 canvas 截图）
    video.muted = true; // 静音
    video.playsInline = true; // 在移动设备上内联播放
    video.style.position = "fixed"; // 固定定位
    video.style.left = "-9999px"; // 移出可视区域
    video.style.top = "-9999px";

    // 添加到 DOM（某些浏览器需要元素在 DOM 中才能触发事件）
    document.body.appendChild(video);

    // 标记是否已经完成（防止多次调用 resolve/reject）
    let isResolved = false;
    // 存储超时定时器 ID
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    /**
     * 清理资源函数
     * - 清除超时定时器
     * - 移除所有事件监听器
     * - 从 DOM 中移除视频元素
     * - 释放视频资源
     */
    const cleanup = () => {
      if (isResolved) return;
      isResolved = true;

      // 清除超时定时器
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // 移除事件监听器
      video.onloadedmetadata = null;
      video.onerror = null;
      video.onseeked = null;
      video.oncanplay = null;

      // 停止播放并释放资源
      video.pause();
      video.removeAttribute("src");
      video.load(); // 重置视频元素状态

      // 从 DOM 中移除
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
    };

    /**
     * 统一的 resolve 处理函数，确保只调用一次
     */
    const resolveOnce = (value: Omit<VideoResolution, "type"> & { thumbnail?: string }) => {
      if (!isResolved) {
        cleanup();
        resolve(value);
      }
    };

    /**
     * 统一的 reject 处理函数，确保只调用一次
     */
    const rejectOnce = (reason: string) => {
      if (!isResolved) {
        cleanup();
        reject(new Error(`${reason} - URL: ${src}`));
      }
    };

    // 设置超时定时器
    timeoutId = setTimeout(() => {
      rejectOnce(`Video load timed out after ${timeout}ms`);
    }, timeout);

    // 错误处理：视频加载失败
    video.onerror = (event) => {
      let errorMessage = "Video load failed";

      // 尝试获取更详细的错误信息
      if (event instanceof ErrorEvent && event.message) {
        errorMessage += `: ${event.message}`;
      } else if (video.error) {
        const errorCode = video.error.code;
        const errorMessages: Record<number, string> = {
          1: "MEDIA_ERR_ABORTED - 加载被中止",
          2: "MEDIA_ERR_NETWORK - 网络错误",
          3: "MEDIA_ERR_DECODE - 解码错误",
          4: "MEDIA_ERR_SRC_NOT_SUPPORTED - 不支持的视频格式",
        };
        errorMessage += `: ${errorMessages[errorCode] || `Unknown error code ${errorCode}`}`;
      }

      rejectOnce(errorMessage);
    };

    // 元数据加载完成
    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const orientation = getOrientation(width, height);

      // 验证视频尺寸有效性
      if (width <= 0 || height <= 0) {
        rejectOnce("Invalid video dimensions");
        return;
      }

      // 如果不需要生成缩略图，直接返回分辨率信息
      if (isNil(seekTime)) {
        resolveOnce({ width, height, orientation });
        return;
      }

      // 计算目标时间点（确保在视频时长范围内）
      const videoDuration = video.duration || 0;
      if (!isFinite(videoDuration) || videoDuration <= 0) {
        // 如果无法获取视频时长，返回不带缩略图的结果
        resolveOnce({ width, height, orientation });
        return;
      }

      const targetTime = Math.min(Math.max(seekTime!, 0), videoDuration);
      let hasSeeked = false; // 防止多次触发

      /**
       * 捕获视频帧作为缩略图
       */
      const captureFrame = () => {
        if (hasSeeked) return;
        hasSeeked = true;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // 无法获取 canvas 上下文，返回不带缩略图的结果
          resolveOnce({ width, height, orientation });
          return;
        }

        try {
          // 将视频帧绘制到 canvas
          ctx.drawImage(video, 0, 0, width, height);

          // 转换为 base64 JPEG 格式（0.8 质量）
          const thumbnail = canvas.toDataURL("image/jpeg", 0.8);

          resolveOnce({ width, height, thumbnail, orientation });
        } catch (error) {
          // 截图失败（可能是跨域问题），返回不带缩略图的结果
          console.warn("Failed to capture video thumbnail:", error);
          resolveOnce({ width, height, orientation });
        }
      };

      // 监听 seeked 事件（定位完成后触发）
      video.onseeked = captureFrame;

      // 监听 canplay 事件（视频准备好播放时触发）
      // 某些浏览器可能不会触发 seeked 事件，使用 canplay 作为备用
      video.oncanplay = () => {
        if (!hasSeeked) {
          captureFrame();
        }
      };

      // 设置视频播放位置到目标时间点
      try {
        video.currentTime = targetTime;
      } catch (error) {
        // 如果设置 currentTime 失败，返回不带缩略图的结果
        console.warn("Failed to seek video:", error);
        resolveOnce({ width, height, orientation });
      }
    };
  });
}

/**
 * 清除缓存中的特定项或全部缓存
 * @param key - 要清除的缓存 key，如果不提供则清除全部缓存
 */
export function clearMediaResolutionCache(key?: string): void {
  if (key) {
    mediaResolutionCache.delete(key);
  } else {
    mediaResolutionCache.clear();
  }
}

/**
 * 获取当前缓存的大小
 */
export function getMediaResolutionCacheSize(): number {
  return mediaResolutionCache.size;
}
