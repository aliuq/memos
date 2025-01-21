import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { memo, useState, useRef, useCallback, useMemo } from "react";
import { useResourceContext } from "../context/ResourceContext";
import { ThumbnailItem } from "./ThumbnailItem";

export const ThumbnailList = memo(() => {
  const { resources } = useResourceContext();
  const [currentPage, setCurrentPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState(0);

  // 响应式布局配置
  const isMobile = window.matchMedia("(max-width: 640px)").matches;
  const ITEMS_PER_PAGE = isMobile ? 5 : 8;
  const ITEM_GAP = 8;
  const totalPages = Math.ceil(resources.length / ITEMS_PER_PAGE);

  // 计算样式
  const styles = useMemo(() => {
    const gapTotalWidth = ITEM_GAP * (ITEMS_PER_PAGE - 1);

    return {
      containerStyle: {
        width: "calc(100% - 32px)",
        margin: "0 auto",
      },
      wrapperStyle: {
        display: "flex",
        gap: `${ITEM_GAP}px`,
        transition: isSwiping ? "none" : "transform 0.3s ease-in-out",
        transform: `translateX(calc(-${(currentPage * 100) / totalPages}% - ${currentPage * ITEM_GAP}px))`,
        width: `${totalPages * 100}%`,
      },
      itemStyle: {
        width: `calc((100% / ${totalPages} - ${gapTotalWidth}px) / ${ITEMS_PER_PAGE})`,
        flex: "0 0 auto",
      },
    };
  }, [currentPage, totalPages, ITEM_GAP, isSwiping]);

  const canScrollLeft = currentPage > 0;
  const canScrollRight = currentPage < totalPages - 1;

  // 滚动控制
  const handleScroll = useCallback(
    (direction: "left" | "right") => {
      setCurrentPage((prev) => {
        if (direction === "left") {
          return Math.max(0, prev - 1);
        } else {
          return Math.min(totalPages - 1, prev + 1);
        }
      });
    },
    [totalPages],
  );

  // 触摸处理函数
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchStartTime(Date.now());
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isSwiping) return;
      setTouchEnd(e.targetTouches[0].clientX);

      const distance = touchStart - e.targetTouches[0].clientX;
      const element = containerRef.current;
      if (element) {
        const maxScroll = (totalPages - 1) * element.offsetWidth;
        const currentScroll = currentPage * element.offsetWidth;
        const targetScroll = currentScroll + distance;

        let transformValue = -targetScroll;
        if (targetScroll < 0) {
          transformValue = distance * 0.2;
        } else if (targetScroll > maxScroll) {
          transformValue = -maxScroll + (targetScroll - maxScroll) * 0.2;
        }

        element.querySelector("div")!.style.transform = `translateX(${transformValue}px)`;
      }
    },
    [isSwiping, touchStart, currentPage, totalPages],
  );

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping) return;

    const touchDuration = Date.now() - touchStartTime;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    const element = containerRef.current;

    if (element) {
      element.querySelector("div")!.style.transform = `translateX(calc(-${(currentPage * 100) / totalPages}% - ${
        currentPage * ITEM_GAP
      }px))`;
    }

    if (touchDuration > 150 && Math.abs(distance) > minSwipeDistance) {
      if (distance > 0 && currentPage < totalPages - 1) {
        setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
      } else if (distance < 0 && currentPage > 0) {
        setCurrentPage((prev) => Math.max(0, prev - 1));
      }
    }

    setIsSwiping(false);
    setTouchStart(0);
    setTouchEnd(0);
  }, [isSwiping, touchStart, touchEnd, currentPage, totalPages, touchStartTime, ITEM_GAP]);

  return (
    <div className="w-full flex items-stretch gap-2 group relative">
      {canScrollLeft && (
        <button
          className="absolute top-[2px] -left-[14px] w-[12px] h-[calc(100%-4px)] 
            sm:flex-shrink-0 hidden sm:flex items-center justify-center 
            rounded-l-[4px] bg-white/80 hover:bg-white/90 shadow-md backdrop-blur 
            transition-all duration-200 dark:bg-zinc-700/80 dark:hover:bg-zinc-700/90 z-10"
          onClick={() => handleScroll("left")}
        >
          <ChevronLeftIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>
      )}

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden p-[2px] touch-pan-x"
        style={styles.containerStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div style={styles.wrapperStyle}>
          {resources.map((resource, index) => (
            <div key={resource.name} className="aspect-square" style={styles.itemStyle}>
              <ThumbnailItem resource={resource} index={index} />
            </div>
          ))}
        </div>
      </div>

      {canScrollRight && (
        <button
          className="absolute top-[2px] -right-[14px] w-[12px] h-[calc(100%-4px)] 
            sm:flex-shrink-0 hidden sm:flex items-center justify-center 
            rounded-r-[4px] bg-white/80 hover:bg-white/90 shadow-md backdrop-blur 
            transition-all duration-200 dark:bg-zinc-700/80 dark:hover:bg-zinc-700/90 z-10"
          onClick={() => handleScroll("right")}
        >
          <ChevronRightIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>
      )}
    </div>
  );
});

ThumbnailList.displayName = "ThumbnailList";
