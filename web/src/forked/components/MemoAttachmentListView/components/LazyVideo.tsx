import { TriangleAlert, Video } from "lucide-react";
import { MediaProvider } from "media-chrome/dist/react/media-store";
import React, { memo, useEffect, useCallback, ReactNode, useReducer, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useIntersectionObserver, setupVideoInteractionHandler, calculateVideoResolution, generateVideoThumbnail } from "../hooks";
import { Orientation, VideoResolution } from "../types";
import { renderSlot } from "../utils";
import RenderMediaState from "./RenderMediaState";
import ControlsContainer from "./player/ControlsContainer";
import PlayerContainer from "./player/PlayerContainer";
import PlayerVideo, { PlayerVideoProps } from "./player/PlayerVideo";

/**
 * Video loading status enum
 * @description Defines all possible states in video lifecycle
 */
export enum VideoStatus {
  /** Idle state - video not yet entered viewport */
  IDLE = "idle",
  /** Loading - video is loading (including resolution fetch) */
  LOADING = "loading",
  /** Loaded - video fully loaded and playable */
  LOADED = "loaded",
  /** Error - video load failed */
  ERROR = "error",
}

/**
 * LazyVideo component Props interface
 * @description Video component with lazy loading and resolution prefetch
 */
interface LazyVideoProps {
  /** Unique ID */
  id: string;
  /** Video source URL */
  src: string;
  /** Video description text for accessibility */
  alt?: string;
  /** Additional CSS class names for container */
  className?: string;
  /** Video load success callback */
  onLoad?: (state: VideoState) => void;
  /** Status change callback */
  onStatusChange?: (status: VideoStatus) => void;
  /** Video dimensions loaded callback */
  onDimensionsLoad?: (dimensions: VideoResolution) => void;
  /** Render Props pattern children */
  children?: (params: {
    /** Container ref for IntersectionObserver */
    containerRef: React.RefObject<any>;
    /** Video resolution info */
    dimensions: VideoResolution | null;
    /** Current loading status */
    status: VideoStatus;
    /** Default content render */
    content: ReactNode;
    /** Container props */
    containerProps: {
      className?: string;
      [key: string]: any;
    };
  }) => ReactNode;

  /**
   * Custom video render function
   * @param dimensions - Video resolution info
   * @param status - Current loading status
   */
  renderVideo?: (params: { dimensions: VideoResolution | null; status: VideoStatus }) => ReactNode;

  /** Status slots - customize render content for each status */
  slots?: {
    /** Idle status slot */
    idle?: ReactNode | ((state: VideoState) => ReactNode);
    /** Loading slot */
    loading?: ReactNode | ((state: VideoState) => ReactNode);
    /** Error status slot */
    error?: ReactNode | ((state: VideoState) => ReactNode);
    /** Loaded slot (can be used for overlay, etc.) */
    loaded?: ReactNode | ((state: VideoState) => ReactNode);
  };

  /** IntersectionObserver rootMargin, default "100px" */
  rootMargin?: string;
  /** IntersectionObserver threshold, default 0.01 */
  threshold?: number;
  /** Video poster image (cover) URL */
  poster?: string;
  /** Additional props passed to video element */
  videoProps?: PlayerVideoProps;
}

/**
 * Component state interface
 * @description Use useReducer to unify all states, avoid state sync issues
 */
interface VideoState {
  /** Current loading status */
  status: VideoStatus;
  /** Video resolution info */
  dimensions: VideoResolution | null;
  /** Error info (if any) */
  error: Error | null;
}

/**
 * Action type definitions
 */
type VideoAction =
  | { type: "START_LOADING" } // Start loading (entered viewport)
  | { type: "DIMENSIONS_LOADED"; payload: VideoResolution } // Resolution loaded
  | { type: "LOAD_SUCCESS" } // Load success
  | { type: "LOAD_ERROR"; payload: Error } // Load failed
  | { type: "RESET" }; // Reset state

/**
 * State machine Reducer
 * @description Centralized state transition logic for clear and controlled state flow
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
 * Lazy loading video component
 *
 * @description
 * A fully-featured lazy loading video component with:
 * - 🚀 Viewport detection based on IntersectionObserver
 * - 📐 Automatic video resolution fetch for layout optimization
 * - ♿ Full accessibility support
 * - 🎨 Customizable status slots and render functions
 * - 🎯 Render Props pattern for full customization
 * - 🎬 Modern playback controls using media-chrome
 *
 * @example
 * ```tsx
 * // Basic usage
 * <LazyVideo src="/video.mp4" poster="/poster.jpg" />
 *
 * // Custom container
 * <LazyVideo src="/video.mp4">
 *   {({ containerRef, content, containerProps }) => (
 *     <div ref={containerRef} {...containerProps} className="custom-wrapper">
 *       {content}
 *     </div>
 *   )}
 * </LazyVideo>
 *
 * // Listen to state changes
 * <LazyVideo
 *   src="/video.mp4"
 *   onStatusChange={(status) => console.log(status)}
 *   onDimensionsLoad={(dims) => console.log(dims)}
 * />
 * ```
 *
 * @performance
 * - Use useReducer for unified state management, reduce re-renders
 * - Automatically cleanup all side effects on component unmount
 * - Use memo to optimize repeated renders
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
  rootMargin = "300px",
  threshold,
  poster,
  videoProps,
}: LazyVideoProps) {
  // ========== State Management ==========
  // Use useReducer to unify all states, avoid state sync issues from multiple useState
  const [state, dispatch] = useReducer(videoReducer, {
    status: VideoStatus.IDLE,
    dimensions: null,
    error: null,
  });

  // ========== Refs ==========

  // ========== Viewport Detection ==========
  /**
   * Use IntersectionObserver to detect if video entered viewport
   * - once: true triggers only once
   * - enabled: only enabled in IDLE state, avoid duplicate triggers
   */
  const { ref: containerRef, hasEntered } = useIntersectionObserver<HTMLDivElement>({
    rootMargin,
    threshold,
    once: true,
    enabled: state.status === VideoStatus.IDLE,
  });

  // ========== Reset State on src Change ==========
  /**
   * Reset all states when src changes
   */
  useEffect(() => {
    dispatch({ type: "RESET" });
    setupVideoInteractionHandler();
  }, [src]);

  // ========== Handle Entry into Viewport ==========
  /**
   * Start loading when video enters viewport (including resolution fetch and video load)
   */
  useEffect(() => {
    if (hasEntered && state.status === VideoStatus.IDLE) {
      dispatch({ type: "START_LOADING" });
    }
  }, [hasEntered, state.status]);

  // ========== Get Video Resolution ==========

  useEffect(() => {
    if (state.status !== VideoStatus.LOADING || state.dimensions) {
      return;
    }
  }, [state.status, state.dimensions]);

  // ========== Video Load Event Handling ==========
  /**
   * Callback when video loads successfully
   */
  const handleLoadedData = useCallback(() => {
    dispatch({ type: "LOAD_SUCCESS" });
    onLoad?.(state);
  }, [onLoad, state]);

  /**
   * Callback when video metadata loads
   * iOS devices may not trigger loadedData event, mark as success when metadata loads
   */
  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
      if (state.status !== VideoStatus.LOADED) {
        const dimensions = calculateVideoResolution(e.currentTarget);

        // If no poster, try to generate thumbnail
        if (!poster) {
          generateVideoThumbnail(e.currentTarget)
            .then((thumbnail) => {
              dispatch({ type: "DIMENSIONS_LOADED", payload: { ...dimensions, thumbnail } as any });
            })
            .catch(() => {
              dispatch({ type: "DIMENSIONS_LOADED", payload: dimensions as any });
              // Focus on load success, avoid failing due to thumbnail error
              dispatch({ type: "LOAD_SUCCESS" });
              onLoad?.(state);
            });
        } else {
          // If poster exists, dispatch immediately without thumbnail
          dispatch({ type: "DIMENSIONS_LOADED", payload: dimensions as any });
        }
      }
    },
    [poster, state.status],
  );

  /**
   * Video load error callback
   */
  const handleError = useCallback(() => {
    const error = new Error(`Video load failed: ${src}`);
    dispatch({ type: "LOAD_ERROR", payload: error });
  }, [src]);

  // ========== State Change Callbacks ==========
  /**
   * Notify external component when state changes
   */
  useEffect(() => {
    onStatusChange?.(state.status);
  }, [state.status, onStatusChange]);

  /**
   * Notify external component when resolution loads
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
   * Render video element
   * Supports full customization via renderVideo prop
   */
  const renderVideoContent = () => {
    // Allow external full control of video rendering
    if (renderVideo) {
      return renderVideo({ dimensions: state.dimensions, status: state.status });
    }
    // Don't render video element in error state
    if (state.status === VideoStatus.ERROR) return null;

    // Only render video in specific states
    const isLoading = state.status === VideoStatus.LOADING;
    const isLoaded = state.status === VideoStatus.LOADED;

    const orientation = state.dimensions?.orientation === Orientation.LANDSCAPE ? "landscape" : "portrait";

    // Default preset: use MediaStore Hooks for fine-grained control
    return (
      (isLoading || isLoaded) &&
      src && (
        <MediaProvider>
          <PlayerContainer className="absolute">
            <PlayerVideo
              id={id}
              src={src}
              poster={placeholderSrc}
              className={cn(
                "transition-all duration-300 ease-in-out",
                // Status
                isLoading && !placeholderSrc && "opacity-0",
                isLoaded && state.dimensions && "opacity-100",
              )}
              data-orientation={orientation}
              onLoadedData={handleLoadedData}
              onError={handleError}
              onLoadedMetadata={(e) => handleLoadedMetadata(e)}
              {...videoProps}
            />

            <ControlsContainer />
          </PlayerContainer>
        </MediaProvider>
      )
    );
  };

  // ========== Compose Render Content ==========
  /**
   * Combine all render layers: state layer -> video
   */
  const content = (
    <>
      {/* Poster image as placeholder */}
      {placeholderSrc && state.status !== VideoStatus.LOADED && (
        <img className="absolute poster inset-0 size-full object-contain" src={placeholderSrc} alt="" aria-hidden="true" />
      )}

      {/* Status layer render - show current loading status */}
      {state.status === VideoStatus.IDLE && renderLoadingState(true)}
      {state.status === VideoStatus.LOADING && renderLoadingState(false)}
      {state.status === VideoStatus.ERROR && renderErrorState()}

      {/* Video element */}
      {renderVideoContent()}

      {/* Slot after loaded (e.g. overlay) */}
      {state.status === VideoStatus.LOADED && renderLoadedState()}
    </>
  );

  // ========== Container Properties Configuration ==========
  /**
   * Build container properties object
   * Includes accessibility, data attributes, interaction events, etc.
   * Use useMemo to avoid unnecessary object recreation
   */
  const containerProps = useMemo(
    () => ({
      className: cn(
        "inline-block relative size-full overflow-hidden rounded-md transition-all duration-300 bg-gray-100 dark:bg-zinc-700",
        className,
      ),
      "data-status": state.status,
      "data-width": state.dimensions ? state.dimensions.width : undefined,
      "data-height": state.dimensions ? state.dimensions.height : undefined,
      role: "video",
      "aria-label": alt || "video",
      "aria-busy": state.status === VideoStatus.LOADING,
    }),
    [className, state.status, state.dimensions, alt],
  );

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
    <div key={id} ref={containerRef} {...containerProps}>
      {content}
    </div>
  );
});
