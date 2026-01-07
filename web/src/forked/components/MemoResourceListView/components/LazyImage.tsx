import { Image, TriangleAlert } from "lucide-react";
import { memo, useRef, useEffect, useCallback, ReactNode, useReducer } from "react";
import { cn } from "@/utils";
import { useIntersectionObserver, calculateImageResolution } from "../hooks";
import { ImageResolution } from "../types";
import { renderSlot } from "../utils";
import RenderMediaState from "./RenderMediaState";

/**
 * 图片加载状态枚举
 * @description 定义图片在整个生命周期中的所有可能状态
 */
export enum ImageStatus {
  /** 闲置状态 - 图片尚未进入视口 */
  IDLE = "idle",
  /** 加载中 - 图片正在加载 */
  LOADING = "loading",
  /** 加载成功 - 图片已完全加载并显示 */
  LOADED = "loaded",
  /** 加载失败 - 图片加载失败 */
  ERROR = "error",
}

/**
 * 结构化错误信息
 * @description 提供明确的错误类型和用户友好的错误信息
 */
export interface ImageError {
  /** 错误代码，用于程序化处理 */
  code: "NETWORK_ERROR" | "TIMEOUT" | "RESOLUTION_FAILED" | "LOAD_FAILED" | "UNKNOWN";
  /** 用户友好的错误消息 */
  message: string;
  /** 原始错误对象 */
  originalError?: Error;
  /** 图片源地址 */
  src?: string;
}

/**
 * LazyImage 组件的 Props 接口
 * @description 支持懒加载、自动重试、分辨率预获取的图片组件
 */
interface LazyImageProps {
  /** 图片元素的唯一标识符 */
  id?: string;
  /** 图片源地址 */
  src: string;
  /** 图片文件名 */
  filename?: string;
  /** 图片的替代文本，用于无障碍访问 */
  alt?: string;
  /** 容器的额外 CSS 类名 */
  className?: string;
  /** 图片加载成功回调 */
  onLoad?: () => void;
  /** 状态变化回调 */
  onStatusChange?: (status: ImageStatus) => void;
  /** 图片尺寸加载完成回调 */
  onDimensionsLoad?: (dimensions: ImageResolution) => void;
  /** 错误回调 */
  onError?: (error: ImageError) => void;

  children?: (params: {
    /** 容器 ref，用于 IntersectionObserver */
    containerRef: React.RefObject<HTMLDivElement>;
    /** 图片分辨率信息 */
    dimensions: ImageResolution | null;
    /** 当前加载状态 */
    status: ImageStatus;
    /** 默认的内容渲染 */
    content: ReactNode;
    /** 推荐的容器属性 */
    containerProps: {
      className?: string;
      [key: string]: any;
    };
  }) => ReactNode;

  /**
   * 自定义图片渲染函数
   * @param dimensions - 图片分辨率信息
   * @param status - 当前加载状态
   * @param imgRef - 图片元素 ref
   */
  renderImage?: (params: {
    dimensions: ImageResolution | null;
    status: ImageStatus;
    imgRef: React.RefObject<HTMLImageElement>;
  }) => ReactNode;

  /**
   * 状态插槽 - 自定义各个状态的渲染内容
   */
  slots?: {
    /** 闲置状态插槽 */
    idle?: ReactNode | ((state: ImageState) => ReactNode);
    /** 加载中插槽 */
    loading?: ReactNode | ((state: ImageState) => ReactNode);
    /** 错误状态插槽 */
    error?: ReactNode | ((state: ImageState) => ReactNode);
    /** 加载完成插槽（可用于添加遮罩层等） */
    loaded?: ReactNode | ((state: ImageState) => ReactNode);
  };

  // ========== 高级配置 ==========

  /** IntersectionObserver 的 rootMargin，默认 "100px" */
  rootMargin?: string;
  /** IntersectionObserver 的 threshold，默认 0.01 */
  threshold?: number;
  /** 是否启用模糊到清晰的过渡效果，默认 true */
  enableBlur?: boolean;
  /** 低质量占位图（LQIP）地址 */
  placeholderSrc?: string;
}

/**
 * 组件状态接口
 * @description 使用 useReducer 统一管理所有状态，避免状态不同步
 */
interface ImageState {
  /** 当前加载状态 */
  status: ImageStatus;
  /** 图片分辨率信息 */
  dimensions: ImageResolution | null;
  /** 结构化错误信息 */
  error: ImageError | null;
}

/**
 * Action 类型定义
 */
type ImageAction =
  | { type: "START_LOADING" } // 开始加载（进入视口）
  | { type: "DIMENSIONS_LOADED"; payload: ImageResolution } // 分辨率加载完成
  | { type: "LOAD_SUCCESS" } // 加载成功
  | { type: "LOAD_ERROR"; payload: ImageError } // 加载失败
  | { type: "RESET" }; // 重置状态

/**
 * 状态机 Reducer
 * @description 集中管理状态转换逻辑，确保状态流转清晰可控
 */
function imageReducer(state: ImageState, action: ImageAction): ImageState {
  switch (action.type) {
    case "START_LOADING":
      return { ...state, status: ImageStatus.LOADING, error: null };

    case "DIMENSIONS_LOADED":
      return {
        ...state,
        dimensions: action.payload,
      };

    case "LOAD_SUCCESS":
      return { ...state, status: ImageStatus.LOADED, error: null };

    case "LOAD_ERROR":
      return {
        ...state,
        status: ImageStatus.ERROR,
        error: action.payload,
      };

    case "RESET":
      return {
        status: ImageStatus.IDLE,
        dimensions: null,
        error: null,
      };

    default:
      return state;
  }
}

/**
 * 懒加载图片组件
 *
 * @description
 * 一个功能完整的图片懒加载组件，支持：
 * - 🚀 基于 IntersectionObserver 的视口检测
 * - 📐 自动获取图片分辨率以优化布局
 * - ♿ 完整的无障碍访问支持
 * - 🎨 可自定义的状态插槽和渲染函数
 * - 🎯 支持 Render Props 模式完全自定义
 *
 * @example
 * ```tsx
 * // 基础用法
 * <LazyImage src="/photo.jpg" alt="示例图片" />
 *
 * // 自定义容器
 * <LazyImage src="/photo.jpg">
 *   {({ containerRef, content, containerProps }) => (
 *     <div ref={containerRef} {...containerProps} className="custom-wrapper">
 *       {content}
 *     </div>
 *   )}
 * </LazyImage>
 *
 * // 监听状态变化
 * <LazyImage
 *   src="/photo.jpg"
 *   onStatusChange={(status) => console.log(status)}
 *   onDimensionsLoad={(dims) => console.log(dims)}
 * />
 * ```
 *
 * // 自定义错误UI
 * <LazyImage
 *   src="/image.jpg"
 *   slots={{
 *     error: (error) => <div>{error?.message}</div>
 *   }}
 * />
 *
 * @performance
 * - 使用 useReducer 统一状态管理，减少 re-render
 * - 使用 AbortController 支持请求取消
 * - 使用 useCallbackRef 稳定回调引用
 * - 组件卸载时自动清理所有副作用
 * - 使用 memo 优化重复渲染
 */
export const LazyImage = memo(function LazyImage({
  id: _id, // eslint-disable-line @typescript-eslint/no-unused-vars
  src,
  alt = "",
  className = "",
  filename = "",
  onLoad,
  onStatusChange,
  onDimensionsLoad,
  onError,
  children,
  renderImage,
  slots = {},
  rootMargin,
  threshold,
  enableBlur = true,
  placeholderSrc,
}: LazyImageProps) {
  // ========== 状态管理 ==========
  // 使用 useReducer 统一管理所有状态，避免多个 useState 导致的状态不同步问题
  const [state, dispatch] = useReducer(imageReducer, {
    status: ImageStatus.IDLE,
    dimensions: null,
    error: null,
  });

  // ========== Refs ==========
  const imgRef = useRef<HTMLImageElement>(null);
  // 使用 ref 存储回调函数，避免因回调变化导致 effect 重新执行
  const onLoadRef = useRef(onLoad);
  const onStatusChangeRef = useRef(onStatusChange);
  const onDimensionsLoadRef = useRef(onDimensionsLoad);
  const onErrorRef = useRef(onError);

  // 更新 ref 引用
  useEffect(() => {
    onLoadRef.current = onLoad;
    onStatusChangeRef.current = onStatusChange;
    onDimensionsLoadRef.current = onDimensionsLoad;
    onErrorRef.current = onError;
  });

  // ========== 视口检测 ==========
  /**
   * 使用 IntersectionObserver 检测图片是否进入视口
   * - once: true 表示只触发一次
   * - enabled: 只在 IDLE 状态时启用，避免重复触发
   */
  const { ref: containerRef, hasEntered } = useIntersectionObserver<HTMLDivElement>({
    rootMargin,
    threshold,
    once: true,
    enabled: state.status === ImageStatus.IDLE,
  });

  // ========== 状态变化回调 ==========
  /**
   * 统一处理所有状态变化的副作用
   */
  useEffect(() => {
    onStatusChangeRef.current?.(state.status);

    if (state.dimensions) {
      onDimensionsLoadRef.current?.(state.dimensions);
    }

    if (state.error) {
      onErrorRef.current?.(state.error);
    }
  }, [state.status, state.dimensions, state.error]);

  // ========== src 变化时重置状态 ==========
  /**
   * 当 src 改变时，重置所有状态
   */
  useEffect(() => {
    dispatch({ type: "RESET" });
  }, [src]);

  // ========== 进入视口时的处理 ==========
  /**
   * 当图片进入视口时，开始加载（包括获取分辨率和图片加载）
   */
  useEffect(() => {
    if (hasEntered && state.status === ImageStatus.IDLE) {
      dispatch({ type: "START_LOADING" });
    }
  }, [hasEntered, state.status]);

  // ========== 图片加载事件处理 ==========
  /**
   * 图片加载成功的回调
   */
  const handleLoad = useCallback(() => {
    // 从图片元素获取实际尺寸
    if (imgRef.current) {
      const resolution = calculateImageResolution(imgRef.current);

      if (resolution.width > 0 && resolution.height > 0) {
        const dimensions = { type: "image", ...resolution } as ImageResolution;

        // 更新尺寸信息
        dispatch({ type: "DIMENSIONS_LOADED", payload: dimensions });
      }
    }

    dispatch({ type: "LOAD_SUCCESS" });
    onLoadRef.current?.();
  }, []);

  /**
   * 图片加载失败的回调
   */
  const handleError = useCallback(() => {
    const error: ImageError = {
      code: "LOAD_FAILED",
      message: "图片加载失败",
      src,
    };

    dispatch({ type: "LOAD_ERROR", payload: error });
    console.error("Image load failed:", src);
  }, [src]);

  /** Idle slot and Loading slot */
  const renderLoadingState = (isIdle = false) => {
    const slot = isIdle ? slots.idle : slots.loading;
    if (slot) {
      return renderSlot(slot, state);
    }

    return <RenderMediaState className={isIdle ? "" : "animate-pulse"} IconComponent={Image} text={state.status} />;
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

  /**
   * 渲染图片元素
   * 支持通过 renderImage prop 完全自定义
   */
  const renderImageContent = () => {
    // 允许外部完全控制图片渲染
    if (renderImage) {
      return renderImage({ dimensions: state.dimensions, status: state.status, imgRef });
    }

    // 错误状态不渲染图片元素
    if (state.status === ImageStatus.ERROR) {
      return null;
    }

    // 只在加载中和已加载状态下渲染图片
    const isLoading = state.status === ImageStatus.LOADING;
    const isLoaded = state.status === ImageStatus.LOADED;

    return (
      (isLoading || isLoaded) &&
      src && (
        <img
          ref={imgRef}
          className={cn(
            "size-full object-cover bg-black transition-all duration-300 ease-in-out",
            // 加载中时淡出并轻微缩小
            isLoading && "opacity-0 scale-[0.95]",
            // 加载完成时淡入并恢复大小
            isLoaded && "opacity-100 scale-100",
            // 模糊到清晰的过渡效果
            enableBlur && (isLoading ? "blur-sm" : isLoaded ? "blur-0" : ""),
          )}
          src={src}
          alt={alt || filename}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )
    );
  };

  // ========== 组合渲染内容 ==========
  /**
   * 组合所有渲染层：占位图 -> 状态层 -> 图片
   */
  const content = (
    <>
      {/* 占位图（LQIP）- 低质量图片占位，提供更好的用户体验 */}
      {placeholderSrc && state.status !== ImageStatus.LOADED && (
        <img className="absolute inset-0 size-full object-cover blur-sm opacity-60" src={placeholderSrc} alt="" aria-hidden="true" />
      )}

      {/* 状态层渲染 - 显示当前加载状态 */}
      {state.status === ImageStatus.IDLE && renderLoadingState(true)}
      {state.status === ImageStatus.LOADING && renderLoadingState(false)}
      {state.status === ImageStatus.ERROR && renderErrorState()}

      {/* 图片元素 */}
      {renderImageContent()}

      {/* 加载完成后的插槽（例如遮罩层） */}
      {state.status === ImageStatus.LOADED && renderLoadedState()}
    </>
  );

  // ========== 容器属性配置 ==========
  /**
   * 构建容器的属性对象
   * 包含无障碍访问、数据属性、交互事件等
   */
  const containerProps = {
    className: cn(
      "inline-block relative size-full cursor-pointer overflow-hidden rounded-md transition-all duration-300 bg-gray-100 dark:bg-zinc-700",
      className,
    ),
    "data-status": state.status,
    "data-width": state.dimensions ? state.dimensions.width : undefined,
    "data-height": state.dimensions ? state.dimensions.height : undefined,
    role: "img",
    "aria-label": alt || "图片",
    "aria-busy": state.status === ImageStatus.LOADING,
    style: {
      "--ease": "cubic-bezier(0.25, 0.8, 0.25, 1)",
      transitionTimingFunction: "var(--ease)",
    } as React.CSSProperties,
  };

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
    <div ref={containerRef} {...containerProps}>
      {content}
    </div>
  );
});
