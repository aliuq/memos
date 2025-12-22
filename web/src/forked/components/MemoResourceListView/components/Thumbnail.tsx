import { Play } from "lucide-react";
import { memo, useState, useRef, useCallback, useEffect } from "react";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { getResourceType, getResourceUrl } from "@/utils/resource";
import { useResourceContext } from "../context/ResourceContext";
import { getVideoThumbnail, thumbnailCache } from "../utils/thumbnailCache";
import { LazyImage } from "./LazyImage";

// ThumbnailItem 接口和组件
interface ThumbnailItemProps {
  resource: Resource;
  index: number;
}

export const ThumbnailItem = memo(({ resource, index }: ThumbnailItemProps) => {
  const { activeIndex, setActiveIndex, setShowVideo, setRotation } = useResourceContext();
  const type = getResourceType(resource);
  const resourceUrl = getResourceUrl(resource);
  const [posterUrl, setPosterUrl] = useState<string>("");
  const isActive = index === activeIndex;

  useEffect(() => {
    if (type === "video/*") {
      if (thumbnailCache.has(resourceUrl)) {
        setPosterUrl(thumbnailCache.get(resourceUrl)!);
        return;
      }

      // 使用 Promise.race 添加超时处理
      const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("Thumbnail generation timeout")), 5000));

      Promise.race([getVideoThumbnail(resourceUrl), timeoutPromise])
        .then((thumbnail) => {
          if (thumbnail) {
            thumbnailCache.set(resourceUrl, thumbnail);
            setPosterUrl(thumbnail);
          }
        })
        .catch((error) => {
          console.warn("Failed to generate video thumbnail:", error);
          // 设置一个默认的视频封面，或者使用其他后备方案
          setPosterUrl("");
        });
    }
  }, [resourceUrl, type]);

  const handleClick = useCallback(() => {
    setActiveIndex(index);
    setShowVideo(false);
    setRotation(0);
  }, [index, setActiveIndex, setShowVideo, setRotation]);

  return (
    <div
      className={`relative w-full h-full cursor-pointer rounded overflow-hidden group
        ${isActive ? "outline outline-2 outline-blue-500" : ""}`}
      onClick={handleClick}
    >
      {/* 添加索引显示 */}
      <div className="absolute top-1 right-1 px-1 text-xs bg-black/50 backdrop-blur-sm rounded text-white z-10">{index + 1}</div>

      {type === "image/*" ? (
        <>
          <LazyImage className="size-full" src={resource.externalLink ? resourceUrl : resourceUrl + "?thumbnail=true"} alt="" />
          <div
            className={`absolute inset-0 transition-colors duration-200 
              ${isActive ? "bg-black/10" : "bg-black/20 group-hover:bg-black/10"}`}
          />
        </>
      ) : (
        <div className="relative size-full">
          <LazyImage className="size-full" src={posterUrl} alt="" />
          <div
            className={`absolute inset-0 flex items-center justify-center transition-colors duration-200 
              ${isActive ? "bg-black/30" : "bg-black/40 group-hover:bg-black/30"}`}
          >
            <div className="p-1 rounded-full bg-black/50 text-white">
              <Play size={16} className="fill-white" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ThumbnailList 组件
export const ThumbnailList = memo(() => {
  const { resources, activeIndex } = useResourceContext();
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [needSlide, setNeedSlide] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalSlides, setTotalSlides] = useState(0);
  const THUMB_WIDTH = 72; // 缩略图宽度
  const THUMB_GAP = 8; // 间距
  const ITEM_TOTAL_WIDTH = THUMB_WIDTH + THUMB_GAP; // 单个项目总宽度

  // 计算当前活动项所在的滑块索引
  const getSlideIndexByItemIndex = useCallback(
    (itemIndex: number) => {
      if (!containerRef.current) return 0;

      const containerWidth = containerRef.current.clientWidth;
      const itemsPerView = Math.floor(containerWidth / ITEM_TOTAL_WIDTH);
      return Math.floor(itemIndex / itemsPerView);
    },
    [ITEM_TOTAL_WIDTH],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const containerWidth = container.clientWidth;
      const itemsPerView = Math.floor(containerWidth / ITEM_TOTAL_WIDTH);
      const currentFirstItem = Math.floor(scrollLeft / ITEM_TOTAL_WIDTH);
      setCurrentSlide(Math.floor(currentFirstItem / itemsPerView));
    };

    const updateSlideInfo = () => {
      const containerWidth = container.clientWidth;
      const itemsPerView = Math.floor(containerWidth / ITEM_TOTAL_WIDTH);
      const totalSlides = Math.ceil(resources.length / itemsPerView);

      setNeedSlide(resources.length > itemsPerView);
      setTotalSlides(totalSlides);

      // 根据当前活动项更新滑块位置
      setCurrentSlide(getSlideIndexByItemIndex(activeIndex));
    };

    container.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", updateSlideInfo);
    updateSlideInfo(); // 初始计算

    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateSlideInfo);
    };
  }, [resources.length, ITEM_TOTAL_WIDTH, activeIndex, getSlideIndexByItemIndex]);

  // 当活动项改变时，更新滑块位置
  useEffect(() => {
    setCurrentSlide(getSlideIndexByItemIndex(activeIndex));
  }, [activeIndex, getSlideIndexByItemIndex]);

  const scrollToActiveItem = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const itemsPerView = Math.floor(containerWidth / ITEM_TOTAL_WIDTH);
    const targetSlide = Math.floor(activeIndex / itemsPerView);

    container.scrollTo({
      left: targetSlide * (itemsPerView * ITEM_TOTAL_WIDTH),
      behavior: "smooth",
    });
  }, [activeIndex, ITEM_TOTAL_WIDTH]);

  useEffect(() => {
    scrollToActiveItem();
  }, [activeIndex, scrollToActiveItem]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current!.offsetLeft);
    setScrollLeft(containerRef.current!.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const x = e.pageX - containerRef.current!.offsetLeft;
    const walk = (x - startX) * 2;
    containerRef.current!.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleScroll = useCallback((direction: number) => {
    if (!containerRef.current) return;

    containerRef.current.scrollBy({
      left: direction * 100,
      behavior: "smooth",
    });
  }, []);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      handleScroll(e.deltaY > 0 ? 1 : -1);
    },
    [handleScroll],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 添加带 passive: false 的事件监听
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  // 预加载下一页的视频封面
  useEffect(() => {
    const preloadNextPageThumbnails = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.clientWidth;
      const itemsPerView = Math.floor(containerWidth / ITEM_TOTAL_WIDTH);
      const nextPageStart = (currentSlide + 1) * itemsPerView;
      const nextPageEnd = Math.min(nextPageStart + itemsPerView, resources.length);

      for (let i = nextPageStart; i < nextPageEnd; i++) {
        const resource = resources[i];
        if (getResourceType(resource) === "video/*") {
          const resourceUrl = getResourceUrl(resource);
          if (!thumbnailCache.has(resourceUrl)) {
            getVideoThumbnail(resourceUrl)
              .then((thumbnail) => {
                if (thumbnail) {
                  thumbnailCache.set(resourceUrl, thumbnail);
                }
              })
              .catch(console.warn);
          }
        }
      }
    };

    preloadNextPageThumbnails();
  }, [currentSlide, resources, ITEM_TOTAL_WIDTH]);

  return (
    <div className="relative w-full bg-black/50 backdrop-blur-sm rounded-xl p-2">
      <div className="relative overflow-hidden">
        <div
          ref={containerRef}
          className="flex gap-2 overflow-x-auto hide-scrollbar overscroll-x-contain touch-pan-x"
          style={{
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {resources.map((resource, index) => (
            <div key={resource.name} className="flex-shrink-0 w-[72px] aspect-square scroll-snap-align-start">
              <ThumbnailItem resource={resource} index={index} />
            </div>
          ))}
        </div>

        {/* 仅在需要滑动时显示渐变遮罩 */}
        {needSlide && (
          <>
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/50 to-transparent pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/50 to-transparent pointer-events-none" />
          </>
        )}
      </div>

      {/* 更新后的滚动指示器 */}
      {needSlide && totalSlides > 1 && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div
              key={i}
              className={`w-1 h-1 rounded-full transition-colors duration-200 
                ${currentSlide === i ? "bg-white" : "bg-white/30"}`}
              onClick={() => {
                const container = containerRef.current;
                if (!container) return;
                const itemsPerView = Math.floor(container.clientWidth / ITEM_TOTAL_WIDTH);
                const targetIndex = i * itemsPerView;
                if (targetIndex < resources.length) {
                  container.scrollTo({
                    left: i * (itemsPerView * ITEM_TOTAL_WIDTH),
                    behavior: "smooth",
                  });
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
});

ThumbnailItem.displayName = "ThumbnailItem";
ThumbnailList.displayName = "ThumbnailList";
