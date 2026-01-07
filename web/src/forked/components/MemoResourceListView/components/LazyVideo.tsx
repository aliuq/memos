import { TriangleAlert, Video } from "lucide-react";
import { MediaProvider } from "media-chrome/dist/react/media-store";
import { memo, useRef, useEffect, useCallback, ReactNode, useReducer, useMemo } from "react";
import { cn } from "@/utils";
import { useIntersectionObserver, useMediaResolution } from "../hooks";
import { Orientation, VideoResolution } from "../types";
import { renderSlot } from "../utils";
import RenderMediaState from "./RenderMediaState";
import ControlsContainer from "./player/ControlsContainer";
import PlayerContainer from "./player/PlayerContainer";
import PlayerVideo, { PlayerVideoProps } from "./player/PlayerVideo";

/**
 * 视频加载状态枚举
 * @description 定义视频在整个生命周期中的所有可能状态
 */
export enum VideoStatus {
  /** 闲置状态 - 视频尚未进入视口 */
  IDLE = "idle",
  /** 加载中 - 视频正在加载（包括获取分辨率） */
  LOADING = "loading",
  /** 加载成功 - 视频已完全加载并可播放 */
  LOADED = "loaded",
  /** 加载失败 - 视频加载失败 */
  ERROR = "error",
}

/**
 * LazyVideo 组件的 Props 接口
 * @description 支持懒加载、分辨率预获取的视频组件
 */
interface LazyVideoProps {
  /** 唯一 ID */
  id: string;
  /** 视频源地址 */
  src: string;
  /** 视频的描述文本，用于无障碍访问 */
  alt?: string;
  /** 容器的额外 CSS 类名 */
  className?: string;
  /** 视频加载成功回调 */
  onLoad?: (state: VideoState) => void;
  /** 状态变化回调 */
  onStatusChange?: (status: VideoStatus) => void;
  /** 视频尺寸加载完成回调 */
  onDimensionsLoad?: (dimensions: VideoResolution) => void;
  /** Render Props 模式的子组件 */
  children?: (params: {
    /** 容器 ref，用于 IntersectionObserver */
    containerRef: React.RefObject<any>;
    /** 视频分辨率信息 */
    dimensions: VideoResolution | null;
    /** 当前加载状态 */
    status: VideoStatus;
    /** 默认的内容渲染 */
    content: ReactNode;
    /** 容器属性 */
    containerProps: {
      className?: string;
      [key: string]: any;
    };
  }) => ReactNode;

  /**
   * 自定义视频渲染函数
   * @param dimensions - 视频分辨率信息
   * @param status - 当前加载状态
   */
  renderVideo?: (params: { dimensions: VideoResolution | null; status: VideoStatus }) => ReactNode;

  /** 状态插槽 - 自定义各个状态的渲染内容 */
  slots?: {
    /** 闲置状态插槽 */
    idle?: ReactNode | ((state: VideoState) => ReactNode);
    /** 加载中插槽 */
    loading?: ReactNode | ((state: VideoState) => ReactNode);
    /** 错误状态插槽 */
    error?: ReactNode | ((state: VideoState) => ReactNode);
    /** 加载完成插槽（可用于添加遮罩层等） */
    loaded?: ReactNode | ((state: VideoState) => ReactNode);
  };

  /** IntersectionObserver 的 rootMargin，默认 "100px" */
  rootMargin?: string;
  /** IntersectionObserver 的 threshold，默认 0.01 */
  threshold?: number;
  /** 视频海报图（封面）地址 */
  poster?: string;
  /** 传递给视频元素的额外属性 */
  videoProps?: PlayerVideoProps;
}

/**
 * 组件状态接口
 * @description 使用 useReducer 统一管理所有状态，避免状态不同步
 */
interface VideoState {
  /** 当前加载状态 */
  status: VideoStatus;
  /** 视频分辨率信息 */
  dimensions: VideoResolution | null;
  /** 错误信息（如果有） */
  error: Error | null;
}

/**
 * Action 类型定义
 */
type VideoAction =
  | { type: "START_LOADING" } // 开始加载（进入视口）
  | { type: "DIMENSIONS_LOADED"; payload: VideoResolution } // 分辨率加载完成
  | { type: "LOAD_SUCCESS" } // 加载成功
  | { type: "LOAD_ERROR"; payload: Error } // 加载失败
  | { type: "RESET" }; // 重置状态

/**
 * 状态机 Reducer
 * @description 集中管理状态转换逻辑，确保状态流转清晰可控
 */
function videoReducer(state: VideoState, action: VideoAction): VideoState {
  switch (action.type) {
    case "START_LOADING":
      return { ...state, status: VideoStatus.LOADING, error: null };

    case "DIMENSIONS_LOADED":
      return {
        ...state,
        dimensions: action.payload,
      };

    case "LOAD_SUCCESS":
      return { ...state, status: VideoStatus.LOADED, error: null };

    case "LOAD_ERROR":
      return {
        ...state,
        status: VideoStatus.ERROR,
        error: action.payload,
      };

    case "RESET":
      return {
        status: VideoStatus.IDLE,
        dimensions: null,
        error: null,
      };

    default:
      return state;
  }
}

/**
 * 懒加载视频组件
 *
 * @description
 * 一个功能完整的视频懒加载组件，支持：
 * - 🚀 基于 IntersectionObserver 的视口检测
 * - 📐 自动获取视频分辨率以优化布局
 * - ♿ 完整的无障碍访问支持
 * - 🎨 可自定义的状态插槽和渲染函数
 * - 🎯 支持 Render Props 模式完全自定义
 * - 🎬 使用 media-chrome 提供现代化的播放控制界面
 *
 * @example
 * ```tsx
 * // 基础用法
 * <LazyVideo src="/video.mp4" poster="/poster.jpg" />
 *
 * // 自定义容器
 * <LazyVideo src="/video.mp4">
 *   {({ containerRef, content, containerProps }) => (
 *     <div ref={containerRef} {...containerProps} className="custom-wrapper">
 *       {content}
 *     </div>
 *   )}
 * </LazyVideo>
 *
 * // 监听状态变化
 * <LazyVideo
 *   src="/video.mp4"
 *   onStatusChange={(status) => console.log(status)}
 *   onDimensionsLoad={(dims) => console.log(dims)}
 * />
 * ```
 *
 * @performance
 * - 使用 useReducer 统一状态管理，减少 re-render
 * - 组件卸载时自动清理所有副作用
 * - 使用 memo 优化重复渲染
 */
export const LazyVideo = memo(function LazyVideo({
  id,
  src,
  alt = "",
  className = "",
  onLoad,
  onStatusChange,
  onDimensionsLoad,
  children,
  renderVideo,
  slots = {},
  rootMargin = "300px", // IntersectionObserver 的 rootMargin，提前 300px 开始加载
  threshold = 0.01, // IntersectionObserver 的 threshold，元素可见 1% 时触发
  poster,
  videoProps,
}: LazyVideoProps) {
  // ========== 状态管理 ==========
  // 使用 useReducer 统一管理所有状态，避免多个 useState 导致的状态不同步问题
  const [state, dispatch] = useReducer(videoReducer, {
    status: VideoStatus.IDLE,
    dimensions: null,
    error: null,
  });

  // ========== Refs ==========
  // 检测 iOS 设备（只需检测一次）
  const isIosRef = useRef(typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent));

  // ========== 视口检测 ==========
  /**
   * 使用 IntersectionObserver 检测视频是否进入视口
   * - once: true 表示只触发一次
   * - enabled: 只在 IDLE 状态时启用，避免重复触发
   */
  const { ref: containerRef, hasEntered } = useIntersectionObserver<HTMLDivElement>({
    rootMargin,
    threshold,
    once: true,
    enabled: state.status === VideoStatus.IDLE,
  });

  // ========== src 变化时重置状态 ==========
  /**
   * 当 src 改变时，重置所有状态
   */
  useEffect(() => {
    dispatch({ type: "RESET" });
  }, [src]);

  // ========== 进入视口时的处理 ==========
  /**
   * 当视频进入视口时，开始加载（包括获取分辨率和视频加载）
   */
  useEffect(() => {
    if (hasEntered && state.status === VideoStatus.IDLE) {
      dispatch({ type: "START_LOADING" });
    }
  }, [hasEntered, state.status]);

  // ========== 获取视频分辨率 ==========
  /**
   * 在 LOADING 状态且未获取分辨率时获取视频分辨率
   */
  const { resolution: videoResolution, error: resolutionError } = useMediaResolution(src, {
    type: "video",
    seekTime: poster ? null : 0.5,
    key: id,
  });

  useEffect(() => {
    if (state.status !== VideoStatus.LOADING || state.dimensions) {
      return;
    }

    if (videoResolution) {
      dispatch({ type: "DIMENSIONS_LOADED", payload: videoResolution as VideoResolution });
    } else if (resolutionError) {
      dispatch({ type: "LOAD_ERROR", payload: resolutionError });
    }
  }, [state.status, state.dimensions, videoResolution, resolutionError]);

  // ========== 视频加载事件处理 ==========
  /**
   * 视频加载成功的回调
   */
  const handleLoadedData = useCallback(() => {
    dispatch({ type: "LOAD_SUCCESS" });
    onLoad?.(state);
  }, [onLoad, state]);

  /**
   * 视频元数据加载完成的回调
   * iOS 设备可能不触发 loadedData 事件，需要在 metadata 加载完成时标记为成功
   */
  const handleLoadedMetadata = useCallback(() => {
    if (isIosRef.current && state.status !== VideoStatus.LOADED) {
      dispatch({ type: "LOAD_SUCCESS" });
      onLoad?.(state);
    }
  }, [onLoad, state]);

  /**
   * 视频加载失败的回调
   */
  const handleError = useCallback(() => {
    dispatch({ type: "LOAD_ERROR", payload: new Error("Video load failed") });
    console.error("Video load failed:", src);
  }, [src]);

  // ========== 状态变化回调 ==========
  /**
   * 当状态改变时，通知外部组件
   */
  useEffect(() => {
    onStatusChange?.(state.status);
  }, [state.status, onStatusChange]);

  /**
   * 当分辨率加载完成时，通知外部组件
   */
  useEffect(() => {
    if (state.dimensions) {
      onDimensionsLoad?.(state.dimensions);
    }
  }, [state.dimensions, onDimensionsLoad]);

  /** Idle slot and Loading slot */
  const renderLoadingState = (isIdle = false) => {
    const slot = isIdle ? slots.idle : slots.loading;
    if (slot) {
      return renderSlot(slot, state);
    }

    return <RenderMediaState className={isIdle ? "" : "animate-pulse"} IconComponent={Video} text={state.status} />;
  };

  /** Error slot */
  const renderErrorState = () => {
    if (slots.error) {
      return renderSlot(slots.error, state);
    }

    return <RenderMediaState IconComponent={TriangleAlert} text={state.status} />;
  };

  /** Loaded slot */
  const renderLoadedState = () => {
    if (slots.loaded) {
      return renderSlot(slots.loaded, state);
    }

    return null;
  };

  const placeholderSrc = poster || (state.dimensions ? state.dimensions.thumbnail : undefined);

  /**
   * 渲染视频元素
   * 支持通过 renderVideo prop 完全自定义
   */
  const renderVideoContent = () => {
    // 允许外部完全控制视频渲染
    if (renderVideo) {
      return renderVideo({ dimensions: state.dimensions, status: state.status });
    }
    // 错误状态不渲染视频元素
    if (state.status === VideoStatus.ERROR) return null;

    // 只在特定状态下渲染视频
    const isLoading = state.status === VideoStatus.LOADING;
    const isLoaded = state.status === VideoStatus.LOADED;

    const orientation = state.dimensions?.orientation === Orientation.LANDSCAPE ? "landscape" : "portrait";

    // 默认预设：使用 MediaStore Hooks 实现精细化控制
    return (
      (isLoading || isLoaded) &&
      src &&
      state.dimensions && (
        <MediaProvider>
          <PlayerContainer className="absolute">
            <PlayerVideo
              id={id}
              src={src}
              className={cn(
                "transition-all duration-300 ease-in-out",
                // Status
                isLoading && !placeholderSrc && "opacity-0",
                isLoaded && "opacity-100",
              )}
              data-orientation={orientation}
              onLoadedData={handleLoadedData}
              onError={handleError}
              onLoadedMetadata={handleLoadedMetadata}
              {...videoProps}
            />

            <ControlsContainer />
          </PlayerContainer>
        </MediaProvider>
      )
    );
  };

  // ========== 组合渲染内容 ==========
  /**
   * 组合所有渲染层：状态层 -> 视频
   */
  const content = (
    <>
      {/* 海报图作为占位 */}
      {placeholderSrc && state.status !== VideoStatus.LOADED && state.dimensions && (
        <img className="absolute poster z-10 inset-0 size-full object-contain" src={placeholderSrc} alt="" aria-hidden="true" />
      )}

      {/* 状态层渲染 - 显示当前加载状态 */}
      {state.status === VideoStatus.IDLE && renderLoadingState(true)}
      {state.status === VideoStatus.LOADING && renderLoadingState(false)}
      {state.status === VideoStatus.ERROR && renderErrorState()}

      {/* 视频元素 */}
      {renderVideoContent()}

      {/* 加载完成后的插槽（例如遮罩层） */}
      {state.status === VideoStatus.LOADED && renderLoadedState()}
    </>
  );

  // ========== 容器属性配置 ==========
  /**
   * 构建容器的属性对象
   * 包含无障碍访问、数据属性、交互事件等
   * 使用 useMemo 避免不必要的对象重建
   */
  const containerProps = useMemo(
    () => ({
      className: cn("inline-block relative size-full overflow-hidden rounded-md transition-all bg-gray-100 dark:bg-zinc-700", className),
      "data-status": state.status,
      "data-width": state.dimensions ? state.dimensions.width : undefined,
      "data-height": state.dimensions ? state.dimensions.height : undefined,
      role: "video",
      "aria-label": alt || "视频",
      "aria-busy": state.status === VideoStatus.LOADING,
      style: {
        "--ease": "cubic-bezier(0.25, 0.8, 0.25, 1)",
        transitionTimingFunction: "var(--ease)",
      } as React.CSSProperties,
    }),
    [className, state.status, state.dimensions, alt],
  );

  // ========== 最终渲染 ==========
  /**
   * 如果提供了 children render prop，让外部完全控制容器结构
   * 否则使用默认的容器包装
   */
  if (children) {
    return children({
      containerRef,
      dimensions: state.dimensions,
      status: state.status,
      content,
      containerProps,
    });
  }

  // 默认渲染：使用内置容器
  return (
    <div key={id} ref={containerRef} {...containerProps}>
      {content}
    </div>
  );
});
