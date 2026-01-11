import { useMediaDispatch, useMediaSelector, MediaActionTypes, timeUtils } from "media-chrome/dist/react/media-store";
import { useState, useRef, useEffect, useCallback, CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface SeekbarProps {
  disabled?: boolean;
  style?: CSSProperties & Partial<Record<keyof typeof basicCssVariables, string>>;
  className?: string;
}

const basicCssVariables = {
  "--seekbar-height": "3px",
  "--seekbar-height-hover": "5px",
  "--seekbar-track-color": "rgba(255, 255, 255, 0.3)",
  "--seekbar-progress-color": "rgba(255, 255, 255, 1)",
  "--seekbar-thumb-size": "12px",
  "--seekbar-thumb-color": "rgba(255, 255, 255, 1)",
  "--seekbar-thumb-shadow": "0 0 8px rgba(255, 255, 255, 0.6)",
} as const;

const { formatTime } = timeUtils;

const Seekbar = ({ disabled = false, style, className = "" }: SeekbarProps) => {
  const dispatch = useMediaDispatch();
  const mediaCurrentTime = useMediaSelector((state) => state.mediaCurrentTime);
  const mediaDuration = useMediaSelector((state) => state.mediaDuration);
  const [min, max] = useMediaSelector((state) => state.mediaSeekable) ?? [];
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const seekbarRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastSeekTimeRef = useRef<number>(0);
  const rectRef = useRef<DOMRect | null>(null);
  const lastClientXRef = useRef<number | null>(null);

  const currentTime = mediaCurrentTime ?? 0;
  const duration = mediaDuration ?? max ?? 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // 缓存 rect 以减少 getBoundingClientRect 调用
  const refreshRect = useCallback(() => {
    if (seekbarRef.current) {
      rectRef.current = seekbarRef.current.getBoundingClientRect();
    }
  }, []);

  const calculateTimeFromPosition = useCallback(
    (clientX: number) => {
      if (!rectRef.current || min === undefined || max === undefined) {
        return null;
      }
      const rect = rectRef.current;
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return min + percent * (max - min);
    },
    [min, max],
  );

  const handleSeek = useCallback(
    (clientX: number) => {
      if (disabled || min === undefined || max === undefined || !rectRef.current) {
        return;
      }

      // 节流：防止过于频繁的 seek 操作（提高到 50ms 减少请求频率）
      const now = Date.now();
      if (now - lastSeekTimeRef.current < 50) {
        return;
      }
      lastSeekTimeRef.current = now;

      const rect = rectRef.current;
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const newTime = min + percent * (max - min);

      const type = MediaActionTypes.MEDIA_SEEK_REQUEST;
      dispatch({ type, detail: newTime });
    },
    [disabled, min, max, dispatch],
  );

  const updateHoverState = useCallback(
    (clientX: number) => {
      if (disabled || !rectRef.current) return;

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        if (!rectRef.current) return;
        const rect = rectRef.current;
        const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        setHoverPosition(percent * 100);

        const time = calculateTimeFromPosition(clientX);
        setHoverTime(time);
      });
    },
    [disabled, calculateTimeFromPosition],
  );

  const handleStart = useCallback(
    (clientX: number) => {
      if (disabled) return;
      refreshRect(); // 刷新 rect 缓存
      setIsDragging(true);
      handleSeek(clientX);
      updateHoverState(clientX);
    },
    [disabled, refreshRect, handleSeek, updateHoverState],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handleStart(e.clientX);
    },
    [handleStart],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        handleStart(e.touches[0].clientX);
      }
    },
    [handleStart],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      updateHoverState(e.clientX);
    },
    [updateHoverState],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        updateHoverState(e.touches[0].clientX);
      }
    },
    [updateHoverState],
  );

  // 直接更新进度 CSS 变量，避免频繁的 React 重渲染
  useEffect(() => {
    if (seekbarRef.current && !isDragging) {
      seekbarRef.current.style.setProperty("--progressed", `${progress}%`);
    }
  }, [progress, isDragging]);

  // 监听 resize 和初始化时刷新 rect 缓存
  useEffect(() => {
    refreshRect();
    window.addEventListener("resize", refreshRect);
    return () => window.removeEventListener("resize", refreshRect);
  }, [refreshRect]);

  useEffect(() => {
    const handleMoveGlobal = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;

      const clientX =
        e instanceof MouseEvent ? e.clientX : e instanceof TouchEvent && e.touches.length > 0 ? e.touches[0].clientX : undefined;
      if (clientX === undefined) return;

      lastClientXRef.current = clientX;
      handleSeek(clientX);
      updateHoverState(clientX);
    };

    const handleEnd = () => {
      // 确保最后位置被应用（处理节流可能跳过的最后一次）
      if (lastClientXRef.current !== null) {
        const rect = rectRef.current;
        if (rect && min !== undefined && max !== undefined) {
          const percent = Math.max(0, Math.min(1, (lastClientXRef.current - rect.left) / rect.width));
          const finalTime = min + percent * (max - min);
          dispatch({ type: MediaActionTypes.MEDIA_SEEK_REQUEST, detail: finalTime });
        }
      }
      lastClientXRef.current = null;
      setIsDragging(false);
      setHoverTime(null);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMoveGlobal, { passive: true });
      document.addEventListener("mouseup", handleEnd);
      document.addEventListener("touchmove", handleMoveGlobal, { passive: true });
      document.addEventListener("touchend", handleEnd);
      document.addEventListener("touchcancel", handleEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleMoveGlobal);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMoveGlobal);
      document.removeEventListener("touchend", handleEnd);
      document.removeEventListener("touchcancel", handleEnd);

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isDragging, handleSeek, updateHoverState, min, max, dispatch]);

  return (
    <div
      ref={seekbarRef}
      data-slot="seekbar"
      className={cn(
        "seekbar-container relative w-full group touch-none select-none",
        disabled ? "seekbar-disabled" : "cursor-pointer",
        isHovering || isDragging ? "h-(--seekbar-height-hover)" : "h-(--seekbar-height)",
        "transition-[height] duration-150 ease",
        className,
      )}
      onMouseEnter={() => !disabled && setIsHovering(true)}
      onMouseLeave={() => {
        if (!disabled) {
          setIsHovering(false);
          setHoverTime(null);
        }
      }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      style={
        {
          ...basicCssVariables,
          ...style,
        } as React.CSSProperties
      }
    >
      {/* 背景轨道 */}
      <div className="seekbar-track absolute inset-0 rounded-full bg-(--seekbar-track-color)" />

      {/* 已播放进度条 */}
      <div
        className={cn(
          "seekbar-progress absolute left-0 top-0 h-full rounded-full bg-(--seekbar-progress-color) w-(--progressed)",
          isDragging ? "transition-none" : "transition-[width] duration-100 ease-linear",
        )}
      />

      {/* 滑块指示器（带扩大的可点击区域） */}
      {!disabled && (
        <>
          {/* 可点击区域扩大（隐藏，用于增加触摸区域） */}
          <div
            className="absolute top-1/2 -translate-y-1/2 left-(--progressed) -translate-x-1/2 w-11 h-11 rounded-full opacity-0"
            style={{ pointerEvents: isHovering || isDragging ? "auto" : "none" }}
          />
          {/* 可视滑块 */}
          <div
            className={cn(
              "seekbar-thumb absolute top-1/2 rounded-full pointer-events-none will-change-transform",
              "duration-100 ease-out left-(--progressed) -translate-x-1/2 -translate-y-1/2",
              isHovering || isDragging ? "scale-100 opacity-100" : "scale-0 opacity-0",
              "w-(--seekbar-thumb-size) h-(--seekbar-thumb-size) bg-(--seekbar-thumb-color) shadow-(--seekbar-thumb-shadow)",
              isDragging ? "transition-[transform,opacity]" : "transition-all",
            )}
          />
        </>
      )}

      {/* 时间提示 */}
      {!disabled && hoverTime !== null && (isHovering || isDragging) && (
        <div
          className="seekbar-tooltip absolute bottom-full mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded pointer-events-none whitespace-nowrap -translate-x-1/2 left-(--hover-position)"
          style={
            {
              "--hover-position": `${hoverPosition}%`,
            } as React.CSSProperties
          }
        >
          {formatTime(hoverTime, mediaDuration)}
        </div>
      )}
    </div>
  );
};

export default Seekbar;
