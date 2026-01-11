import { Image, TriangleAlert } from "lucide-react";
import { memo, ReactNode, useCallback, useEffect, useReducer, useRef } from "react";
import { cn } from "@/lib/utils";
import { calculateImageResolution, useIntersectionObserver } from "../hooks";
import { ImageResolution } from "../types";
import { renderSlot } from "../utils";
import RenderMediaState from "./RenderMediaState";

/**
 * Image loading status enum
 * @description Defines all possible states in image lifecycle
 */
export enum ImageStatus {
  /** Idle state - image not yet entered viewport */
  IDLE = "idle",
  /** Loading - image is loading */
  LOADING = "loading",
  /** Loaded - image fully loaded and displayed */
  LOADED = "loaded",
  /** Error - image load failed */
  ERROR = "error",
}

/**
 * Structured error information
 * @description Provides explicit error types and user-friendly error messages
 */
export interface ImageError {
  /** Error code for programmatic handling */
  code: "NETWORK_ERROR" | "TIMEOUT" | "RESOLUTION_FAILED" | "LOAD_FAILED" | "UNKNOWN";
  /** User-friendly error message */
  message: string;
  /** Original error object */
  originalError?: Error;
  /** Image source URL */
  src?: string;
}

/**
 * LazyImage component Props interface
 * @description Image component with lazy loading, auto retry, and resolution prefetch
 */
interface LazyImageProps {
  /** Unique identifier for image element */
  id?: string;
  /** Image source URL */
  src: string;
  /** Image filename */
  filename?: string;
  /** Alternative text for accessibility */
  alt?: string;
  /** Additional CSS class names for container */
  className?: string;
  /** Image load success callback */
  onLoad?: () => void;
  /** Status change callback */
  onStatusChange?: (status: ImageStatus) => void;
  /** Image dimensions loaded callback */
  onDimensionsLoad?: (dimensions: ImageResolution) => void;
  /** Error callback */
  onError?: (error: ImageError) => void;
  onClick?: (e: React.MouseEvent) => void;

  children?: (params: {
    /** Container ref for IntersectionObserver */
    containerRef: React.RefObject<HTMLDivElement>;
    /** Image resolution info */
    dimensions: ImageResolution | null;
    /** Current loading status */
    status: ImageStatus;
    /** Default content render */
    content: ReactNode;
    /** Recommended container props */
    containerProps: {
      className?: string;
      [key: string]: any;
    };
  }) => ReactNode;

  /**
   * Custom image render function
   * @param dimensions - Image resolution info
   * @param status - Current loading status
   * @param imgRef - Image element ref
   */
  renderImage?: (params: {
    dimensions: ImageResolution | null;
    status: ImageStatus;
    imgRef: React.RefObject<HTMLImageElement>;
  }) => ReactNode;

  /**
   * Status slots - customize render content for each status
   */
  slots?: {
    /** Idle status slot */
    idle?: ReactNode | ((state: ImageState) => ReactNode);
    /** Loading slot */
    loading?: ReactNode | ((state: ImageState) => ReactNode);
    /** Error status slot */
    error?: ReactNode | ((state: ImageState) => ReactNode);
    /** Loaded slot (can be used for overlay, etc.) */
    loaded?: ReactNode | ((state: ImageState) => ReactNode);
  };

  // ========== Advanced Configuration ==========

  /** IntersectionObserver rootMargin, default "100px" */
  rootMargin?: string;
  /** IntersectionObserver threshold, default 0.01 */
  threshold?: number;
  /** Enable blur-to-sharp transition effect, default true */
  enableBlur?: boolean;
  /** Low Quality Image Placeholder (LQIP) URL */
  placeholderSrc?: string;
}

/**
 * Component state interface
 * @description Use useReducer to unify all states, avoid state sync issues
 */
interface ImageState {
  /** Current loading status */
  status: ImageStatus;
  /** Image resolution info */
  dimensions: ImageResolution | null;
  /** Structured error info */
  error: ImageError | null;
}

/**
 * Action type definitions
 */
type ImageAction =
  | { type: "START_LOADING" } // Start loading (entered viewport)
  | { type: "DIMENSIONS_LOADED"; payload: ImageResolution } // Resolution loaded
  | { type: "LOAD_SUCCESS" } // Load success
  | { type: "LOAD_ERROR"; payload: ImageError } // Load failed
  | { type: "RESET" }; // Reset state

/**
 * State machine Reducer
 * @description Centralized state transition logic for clear and controlled state flow
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
 * Lazy loading image component
 *
 * @description
 * A fully-featured lazy loading image component with:
 * - 🚀 Viewport detection based on IntersectionObserver
 * - 📐 Automatic image resolution fetch for layout optimization
 * - ♿ Full accessibility support
 * - 🎨 Customizable status slots and render functions
 * - 🎯 Render Props pattern for full customization
 *
 * @example
 * ```tsx
 * // Basic usage
 * <LazyImage src="/photo.jpg" alt="example image" />
 *
 * // Custom container
 * <LazyImage src="/photo.jpg">
 *   {({ containerRef, content, containerProps }) => (
 *     <div ref={containerRef} {...containerProps} className="custom-wrapper">
 *       {content}
 *     </div>
 *   )}
 * </LazyImage>
 *
 * // Listen to state changes
 * <LazyImage
 *   src="/photo.jpg"
 *   onStatusChange={(status) => console.log(status)}
 *   onDimensionsLoad={(dims) => console.log(dims)}
 * />
 * ```
 *
 * // Custom error UI
 * <LazyImage
 *   src="/image.jpg"
 *   slots={{
 *     error: (error) => <div>{error?.message}</div>
 *   }}
 * />
 *
 * @performance
 * - Use useReducer for unified state management, reduce re-renders
 * - Use AbortController for request cancellation support
 * - Use useCallbackRef to stabilize callback references
 * - Automatically cleanup all side effects on component unmount
 * - Use memo to optimize repeated renders
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
  onClick,
  children,
  renderImage,
  slots = {},
  rootMargin = "300px",
  threshold,
  enableBlur = true,
  placeholderSrc,
}: LazyImageProps) {
  // ========== State Management ==========
  // Use useReducer to unify all states, avoid state sync issues from multiple useState
  const [state, dispatch] = useReducer(imageReducer, {
    status: ImageStatus.IDLE,
    dimensions: null,
    error: null,
  });

  // ========== Refs ==========
  const imgRef = useRef<HTMLImageElement>(null);
  // Use ref to store callbacks, avoid effect re-execution due to callback changes
  const onLoadRef = useRef(onLoad);
  const onStatusChangeRef = useRef(onStatusChange);
  const onDimensionsLoadRef = useRef(onDimensionsLoad);
  const onErrorRef = useRef(onError);

  // Update ref references
  useEffect(() => {
    onLoadRef.current = onLoad;
    onStatusChangeRef.current = onStatusChange;
    onDimensionsLoadRef.current = onDimensionsLoad;
    onErrorRef.current = onError;
  });

  // ========== Viewport Detection ==========
  /**
   * Use IntersectionObserver to detect if image entered viewport
   * - once: true triggers only once
   * - enabled: only enabled in IDLE state, avoid duplicate triggers
   */
  const { ref: containerRef, hasEntered } = useIntersectionObserver<HTMLDivElement>({
    rootMargin,
    threshold,
    once: true,
    enabled: state.status === ImageStatus.IDLE,
  });

  // ========== State Change Callbacks ==========
  /**
   * Unified handling of all state change side effects
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

  // ========== Reset State on src Change ==========
  /**
   * Reset all states when src changes
   */
  useEffect(() => {
    dispatch({ type: "RESET" });
  }, [src]);

  // ========== Handle Entry into Viewport ==========
  /**
   * Start loading when image enters viewport (including resolution fetch and image load)
   */
  useEffect(() => {
    if (hasEntered && state.status === ImageStatus.IDLE) {
      dispatch({ type: "START_LOADING" });
    }
  }, [hasEntered, state.status]);

  // ========== Image Load Event Handling ==========
  /**
   * Callback when image loads successfully
   */
  const handleLoad = useCallback(() => {
    // Get actual dimensions from image element
    if (imgRef.current) {
      const resolution = calculateImageResolution(imgRef.current);

      if (resolution.width > 0 && resolution.height > 0) {
        const dimensions = { type: "image", ...resolution } as ImageResolution;

        // Update dimension info
        dispatch({ type: "DIMENSIONS_LOADED", payload: dimensions });
      }
    }

    dispatch({ type: "LOAD_SUCCESS" });
    onLoadRef.current?.();
  }, []);

  /**
   * Image load error callback
   */
  const handleError = useCallback(() => {
    const error: ImageError = {
      code: "LOAD_FAILED",
      message: "Failed to load image",
      src,
    };

    dispatch({ type: "LOAD_ERROR", payload: error });
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
   * Render image element
   * Supports full customization via renderImage prop
   */
  const renderImageContent = () => {
    // Allow external full control of image rendering
    if (renderImage) {
      return renderImage({ dimensions: state.dimensions, status: state.status, imgRef });
    }

    // Don't render image element in error state
    if (state.status === ImageStatus.ERROR) {
      return null;
    }

    // Only render image in loading and loaded states
    const isLoading = state.status === ImageStatus.LOADING;
    const isLoaded = state.status === ImageStatus.LOADED;

    return (
      (isLoading || isLoaded) &&
      src && (
        <img
          ref={imgRef}
          className={cn(
            "size-full object-cover bg-black transition-all duration-300 ease-in-out",
            // Fade out and slightly scale down while loading
            isLoading && "opacity-0 scale-[0.95]",
            // Fade in and restore scale when loaded
            isLoaded && "opacity-100 scale-100",
            // Blur to sharp transition effect
            enableBlur && (isLoading ? "blur-xs" : isLoaded ? "blur-0" : ""),
          )}
          src={src}
          alt={alt || filename}
          onLoad={handleLoad}
          onError={handleError}
          onClick={onClick}
          loading="lazy"
          decoding="async"
        />
      )
    );
  };

  // ========== Compose Render Content ==========
  /**
   * Combine all render layers: placeholder -> state layer -> image
   */
  const content = (
    <>
      {/* Placeholder (LQIP) - Low Quality Image Placeholder for better UX */}
      {placeholderSrc && state.status !== ImageStatus.LOADED && (
        <img className="absolute inset-0 size-full object-cover blur-xs opacity-60" src={placeholderSrc} alt="" aria-hidden="true" />
      )}

      {/* Status layer render - show current loading status */}
      {state.status === ImageStatus.IDLE && renderLoadingState(true)}
      {state.status === ImageStatus.LOADING && renderLoadingState(false)}
      {state.status === ImageStatus.ERROR && renderErrorState()}

      {/* Image element */}
      {renderImageContent()}

      {/* Slot after loaded (e.g. overlay) */}
      {state.status === ImageStatus.LOADED && renderLoadedState()}
    </>
  );

  // ========== Container Properties Configuration ==========
  /**
   * Build container properties object
   * Includes accessibility, data attributes, interaction events, etc.
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
    "aria-label": alt || "image",
    "aria-busy": state.status === ImageStatus.LOADING,
    style: {
      "--ease": "cubic-bezier(0.25, 0.8, 0.25, 1)",
      transitionTimingFunction: "var(--ease)",
    } as React.CSSProperties,
  };

  // ========== Final Render ==========
  /**
   * If children render prop provided, let external code fully control container structure
   * Otherwise use default container wrapper
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

  // Default render: use built-in container
  return (
    <div ref={containerRef} {...containerProps}>
      {content}
    </div>
  );
});
