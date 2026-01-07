import photoswipe, { SlideData } from "photoswipe";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import { memo, useMemo, useEffect, useRef, useCallback } from "react";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { cn } from "@/utils";
import { getResourceType, getResourceUrl, isImage } from "@/utils/resource";
import { getImageResolution, useMediaQuery } from "../hooks";
import "../photoswipe.css";
import { pauseVideos, retry } from "../utils";
import { LazyImage } from "./LazyImage";
import { LazyVideo } from "./LazyVideo";
import "./player/media-theme-mini";
import "photoswipe/style.css";

interface GridViewProps {
  resources: Resource[];
}

interface RenderMediaProps {
  dataSource: DataSource;
  index: number;
  len: number;
  remainingCount?: number;
}

type DataSource = SlideData & {
  resourceId: string;
  resourceUrl: string;
  isFirst: boolean;
  isLast: boolean;
  original: Resource;
  filename: string;
};

const MAX_DISPLAY_COUNT = 9;

const lightboxCache = new Map<string, PhotoSwipeLightbox>();
let activeMemo: string | null = null;
let delta = 0;
let hasBack = false;

// 这是一个全局的 popstate 监听器
// 写在这里的主要原因是 MemoGridViewNew 是 memo 列表循环中使用到的组件
// 如果在组件内注册监听器，会导致多次注册，产生冲突，delta 计数也会混乱
window.addEventListener("popstate", () => {
  // console.log("Global popstate event triggered.");
  const lightboxIns = activeMemo && lightboxCache.get(activeMemo);

  if (lightboxIns && lightboxIns.pswp?.isOpen) {
    lightboxIns.pswp?.close();
    delta -= 1;
    hasBack = true;
    return;
  }

  if (delta || hasBack) {
    delta += 1; // 如果没有
    // console.log("Popstate event: lightbox was just closed, adjusting history.", -delta);
    window.history.go(-delta);
    // closeFlag = false;
    delta = 0;
    return;
  }
});

const extraClassMap: Record<number, { root: string; child: string }> = {
  4: {
    root: "[grid-template-areas:'a_b_c''d_e_f''g_h_i']",
    child: "[&:nth-child(1)]:[grid-area:a] [&:nth-child(2)]:[grid-area:b] [&:nth-child(3)]:[grid-area:d] [&:nth-child(4)]:[grid-area:e]",
  },
};

/**
 * 显示剩余数量覆盖层
 */
const RemainingCountOverlay = ({ remainingCount }: { remainingCount: number }) => {
  if (!remainingCount || remainingCount <= 0) return null;
  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-2xl font-bold cursor-pointer z-10">
      +{remainingCount}
    </div>
  );
};

const MemoGridView = ({ resources }: GridViewProps) => {
  const len = resources.length;
  const memoId = resources[0]?.memo?.replace(/\//g, "-") || "unknown";
  const galleryRef = useRef<HTMLDivElement>(null);
  const lightboxRef = useRef<PhotoSwipeLightbox | null>(null);

  const sm = useMediaQuery("sm");

  const isVideo = (type: string) => type === "video/*";

  const getResourceId = (resource: Resource) => `${resource.name}`.replace(/\//g, "-");

  // 准备 PhotoSwipe 数据源
  // 默认不包含宽高等数据，将在 itemData 过滤器中动态获取
  const dataSources = useMemo<DataSource[]>(() => {
    return resources.map((resource, index) => {
      const resourceUrl = getResourceUrl(resource);
      const type = getResourceType(resource);
      const resourceId = getResourceId(resource);
      const isFirstMemo = index === 0;
      const isLastMemo = index === MAX_DISPLAY_COUNT - 1;

      const commonData = {
        resourceId,
        resourceUrl,
        isFirst: isFirstMemo,
        isLast: isLastMemo,
        original: resource,
        index,
        filename: resource.filename,
      };

      // 图片
      if (isImage(type)) {
        const thumbUrl = resource.externalLink ? resourceUrl : `${resourceUrl}?thumbnail=true`;
        return {
          src: resourceUrl,
          msrc: thumbUrl,
          type: "image" as const,
          alt: resource.filename,
          ...commonData,
        };
      }
      // 视频
      else if (isVideo(type)) {
        // 视频作为 HTML slide，使用 media-chrome
        return {
          html: `<media-theme-mini id="${resourceId}" src="${resourceUrl}"></media-theme-mini>`,
          type: "video" as const,
          alt: resource.filename,
          ...commonData,
        };
      }
    }) as DataSource[];
  }, [resources]);

  const displayCount = Math.min(dataSources.length, MAX_DISPLAY_COUNT);
  const remainingCount = Math.max(0, dataSources.length - MAX_DISPLAY_COUNT);

  useEffect(() => {
    if (!galleryRef.current) return;

    const lightbox = new PhotoSwipeLightbox({
      dataSource: dataSources,
      bgOpacity: 1,
      maxZoomLevel: 10,
      pswpModule: photoswipe,
      zoom: false,
      close: sm,
    });

    // 添加文件名称显示
    lightbox.on("uiRegister", function () {
      lightbox.pswp?.ui?.registerElement({
        name: "caption",
        order: 9,
        isButton: false,
        appendTo: "bar",
        tagName: "p",
        onInit: (el, pswp) => {
          pswp.on("change", () => {
            el.innerText = pswp?.currSlide?.data.filename || "";
          });
        },
      });
    });

    lightbox.on("afterInit", () => {
      window.history.pushState({ memoId: memoId }, "", "");
      delta += 1;
      activeMemo = memoId;
      hasBack = false;
    });

    lightbox.on("close", () => {
      // console.log("PhotoSwipeLightbox close");
      pauseVideos();
    });

    // 通过 thumbEl filter 关联缩略图元素（用于开启/关闭动画）
    lightbox.addFilter("thumbEl", (thumbEl, data) => {
      const galleryEl = galleryRef.current;
      if (!galleryEl) return thumbEl!;

      // 对于图片，返回 img 元素；对于视频，返回 img 元素
      const mediaEl = galleryEl.querySelector<HTMLElement>(`[data-resource="${data.resourceId}"] img`);
      if (mediaEl) {
        return mediaEl;
      }
      return thumbEl!;
    });

    // 通过 placeholderSrc filter 提供占位图（用于加载动画）
    lightbox.addFilter("placeholderSrc", (placeholderSrc, slide) => {
      if (slide.data.msrc) {
        return slide.data.msrc;
      }
      return placeholderSrc;
    });

    // 从 DOM 或数据中获取实际的媒体尺寸
    lightbox.addFilter("itemData", (itemData, index) => {
      const galleryEl = galleryRef.current;

      itemData.thumbCropped = true;

      if (itemData.type === "image") {
        // 尝试从 DOM 中获取图片尺寸
        if (galleryEl) {
          const el = galleryEl.querySelector(`[data-resource="${itemData.resourceId}"] img`);
          if (el instanceof HTMLImageElement && el.naturalWidth > 0) {
            const w = el.naturalWidth;
            const h = el.naturalHeight;

            const displayHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
            const displayWidth = Math.floor((w / h) * displayHeight);

            itemData.width = displayWidth;
            itemData.height = displayHeight;
            itemData.w = displayWidth;
            itemData.h = displayHeight;
          }
        }

        // 如果 DOM 中没有（第9张以后），需要动态加载图片获取尺寸
        if ((!itemData.w || !itemData.h) && (itemData.msrc || itemData.src)) {
          getImageResolution(itemData.msrc || itemData.src!).then((res) => {
            itemData.width = res.displayWidth;
            itemData.height = res.displayHeight;
            itemData.w = res.displayWidth;
            itemData.h = res.displayHeight;

            // Refresh the slide content to apply new dimensions
            lightbox.pswp?.refreshSlideContent(index);
          });
        }
      } else if (itemData.type === "video") {
        // 自动处理视频尺寸
        if (itemData.msrc && !itemData.html?.includes("poster=")) {
          itemData.html = itemData.html?.replace("<media-theme-mini", `<media-theme-mini poster="${itemData.msrc}"`);
        }
      }

      console.log("itemData prepared:", itemData);
      return itemData;
    });

    // 预加载的 slide 会触发 contentLoad 事件
    // lightbox.on("contentLoad", (e) => {
    //   console.log("PhotoSwipeLightbox contentLoad", e.content.element);
    // });

    // 监听 slide 切换事件，暂停之前的视频，只有一次
    // lightbox.on("change", () => {});

    // content becomes active (the current slide)
    // can be default prevented
    lightbox.on("contentActivate", ({ content }) => {
      // 暂停其他视频
      pauseVideos({ id: content.data.resourceId });

      if (content.type === "video") {
        // 使用更可靠的方式等待视频元素准备好
        const playVideo = () => {
          const currentSlideElement = content.element?.querySelector("media-theme-mini");
          const currentVideo = currentSlideElement?.shadowRoot?.querySelector("video");

          if (currentVideo instanceof HTMLVideoElement) {
            currentVideo.play().then(() => true);
          }
          return false;
        };

        retry(playVideo, { retries: 10, delay: 100 });
      }
    });

    // content becomes inactive (leaving the slide)
    lightbox.on("contentDeactivate", ({ content }) => {
      if (content.type === "video") {
        const videoElement = content.element?.querySelector("media-theme-mini");
        const video = videoElement?.shadowRoot?.querySelector("video");
        if (video instanceof HTMLVideoElement) {
          video.pause();
        }
      }
    });

    lightbox.init();

    lightboxRef.current = lightbox;
    lightboxCache.set(memoId, lightbox);

    return () => {
      lightbox.destroy();
      lightboxRef.current = null;
      lightboxCache.delete(memoId);
    };
  }, [dataSources]);

  // 点击缩略图打开 lightbox
  const handleThumbnailClick = useCallback((index: number) => {
    if (lightboxRef.current) {
      pauseVideos();
      lightboxRef.current.loadAndOpen(index);
    }
  }, []);

  /**
   * 渲染图片 - 使用 useCallback 避免重复创建
   */
  const RenderImage = useCallback(
    ({ dataSource, index, len, remainingCount }: RenderMediaProps) => {
      const { type, original: resource, resourceUrl, resourceId } = dataSource;
      const url = resource.externalLink ? resourceUrl : `${resourceUrl}?thumbnail=true`;

      const layoutClass = {
        landscape: "col-span-2 aspect-[4/3]",
        portrait: "col-span-2 aspect-[3/4]",
        square: "col-span-2 aspect-square",
      };

      return (
        <LazyImage src={url} id={resourceId} alt={dataSource.alt} filename={dataSource.filename}>
          {({ containerRef, content, containerProps, dimensions }) => {
            return (
              <div
                ref={containerRef}
                {...containerProps}
                data-resource={resourceId}
                data-type={type}
                className={cn(
                  containerProps.className,
                  len === 1 && layoutClass[dimensions?.orientation || "square"],
                  len > 1 && "aspect-square",
                  extraClassMap[len]?.child,
                )}
                onClick={() => handleThumbnailClick(index)}
              >
                {content}
                {dataSource.isLast && <RemainingCountOverlay remainingCount={remainingCount!} />}
              </div>
            );
          }}
        </LazyImage>
      );
    },
    [handleThumbnailClick],
  );

  /**
   * 渲染视频 - 使用 useCallback 避免重复创建
   */
  const RenderVideo = useCallback(
    ({ dataSource, index, len, remainingCount }: RenderMediaProps) => {
      const { type, resourceUrl, resourceId } = dataSource;

      const layoutClass = {
        landscape: "col-span-3 aspect-video",
        portrait: "col-span-2 aspect-[3/4] [&_video]:object-cover [&_img.poster]:object-cover",
        square: "col-span-3 aspect-video",
      };

      return (
        <LazyVideo
          src={resourceUrl}
          id={resourceId}
          onLoad={(state) => {
            if (!dataSource.msrc && state.dimensions?.thumbnail) {
              dataSource.msrc = state.dimensions?.thumbnail;
            }
          }}
        >
          {({ containerRef, content, containerProps, dimensions }) => {
            return (
              <div
                ref={containerRef}
                {...containerProps}
                data-resource={resourceId}
                data-type={type}
                className={cn(
                  containerProps.className,
                  len === 1 && (sm ? "col-span-3 aspect-video" : layoutClass[dimensions?.orientation || "square"]),
                  len > 1 && "aspect-square [&_video]:object-cover [&_img.poster]:object-cover",
                  extraClassMap[len]?.child,
                )}
                onClick={() => handleThumbnailClick(index)}
              >
                {content}
                {dataSource.isLast && <RemainingCountOverlay remainingCount={remainingCount!} />}
              </div>
            );
          }}
        </LazyVideo>
      );
    },
    [handleThumbnailClick, sm],
  );

  return (
    <div ref={galleryRef} id={memoId} className="w-full">
      <div
        className={cn(
          "grid gap-[6px] grid-cols-3 overflow-hidden sm:max-w-[400px]",
          len === 1 && dataSources[0].type === "video" && "sm:max-w-[640px]",
          extraClassMap[len]?.root,
        )}
      >
        {dataSources.slice(0, displayCount).map((dataSource, index) => {
          if (dataSource.type === "image") {
            return (
              <RenderImage key={dataSource.resourceId} dataSource={dataSource} index={index} remainingCount={remainingCount} len={len} />
            );
          }
          if (dataSource?.type === "video") {
            return (
              <RenderVideo key={dataSource.resourceId} dataSource={dataSource} index={index} remainingCount={remainingCount} len={len} />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
};

export default memo(MemoGridView);
