import photoswipe, { SlideData } from "photoswipe";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import { memo, useMemo, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { getAttachmentType, getAttachmentUrl, isImage } from "@/utils/attachment";
import { getImageResolution, useMediaQuery } from "../hooks";
import "../photoswipe.css";
import { pauseVideos, retry } from "../utils";
import { LazyImage } from "./LazyImage";
import { LazyVideo } from "./LazyVideo";
import "./player/media-theme-mini";
import "photoswipe/style.css";

interface RenderMediaProps {
  dataSource: DataSource;
  index: number;
  len: number;
  remainingCount?: number;
}

type DataSource = SlideData & {
  attachmentId: string;
  attachmentUrl: string;
  isFirst: boolean;
  isLast: boolean;
  original: Attachment;
  filename: string;
};

const MAX_DISPLAY_COUNT = 9;

const lightboxCache = new Map<string, PhotoSwipeLightbox>();
let activeMemo: string | null = null;
let delta = 0;
let hasBack = false;

// Global popstate listener to handle browser back/forward navigation
// Placed here to avoid multiple registrations in memo list loops
// which would cause conflicts and delta counting issues
//
// 这是一个全局的 popstate 监听器
// 写在这里的主要原因是 MemoGridViewNew 是 memo 列表循环中使用到的组件
// 如果在组件内注册监听器，会导致多次注册，产生冲突，delta 计数也会混乱
window.addEventListener("popstate", () => {
  const lightboxIns = activeMemo && lightboxCache.get(activeMemo);

  if (lightboxIns && lightboxIns.pswp?.isOpen) {
    lightboxIns.pswp?.close();
    delta -= 1;
    hasBack = true;
    return;
  }

  if (delta || hasBack) {
    delta += 1;
    window.history.go(-delta);
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
 * Display overlay showing remaining count
 */
const RemainingCountOverlay = ({ remainingCount }: { remainingCount: number }) => {
  if (!remainingCount || remainingCount <= 0) return null;
  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-2xl font-bold cursor-pointer">
      +{remainingCount}
    </div>
  );
};

const MemoMediaList = ({ attachments }: { attachments: Attachment[] }) => {
  const len = attachments.length;
  const memoId = attachments[0]?.memo?.replace(/\//g, "-") || "unknown";
  const galleryRef = useRef<HTMLDivElement>(null);
  const lightboxRef = useRef<PhotoSwipeLightbox | null>(null);

  const sm = useMediaQuery("sm");

  const isVideo = (type: string) => type === "video/*";

  const getAttachmentId = (attachment: Attachment) => `${attachment.name}`.replace(/\//g, "-");

  // Prepare PhotoSwipe data source
  // Width/height data not included by default, will be dynamically fetched in itemData filter
  const dataSources = useMemo<DataSource[]>(() => {
    return attachments.map((attachment, index) => {
      const attachmentUrl = getAttachmentUrl(attachment);
      const type = getAttachmentType(attachment);
      const attachmentId = getAttachmentId(attachment);
      const isFirstMemo = index === 0;
      const isLastMemo = index === MAX_DISPLAY_COUNT - 1;

      const commonData = {
        attachmentId,
        attachmentUrl,
        isFirst: isFirstMemo,
        isLast: isLastMemo,
        original: attachment,
        index,
        filename: attachment.filename,
      };

      // Image
      if (isImage(type)) {
        const thumbUrl = attachment.externalLink ? attachmentUrl : `${attachmentUrl}?thumbnail=true`;
        return {
          src: attachmentUrl,
          msrc: thumbUrl,
          type: "image" as const,
          alt: attachment.filename,
          ...commonData,
        };
      }
      // Video
      else if (isVideo(type)) {
        // Video as HTML slide, using media-chrome
        return {
          html: `<media-theme-mini id="${attachmentId}" src="${attachmentUrl}"></media-theme-mini>`,
          type: "video" as const,
          alt: attachment.filename,
          ...commonData,
        };
      }
    }) as DataSource[];
  }, [attachments]);

  const displayCount = Math.min(dataSources.length, MAX_DISPLAY_COUNT);
  const remainingCount = Math.max(0, dataSources.length - MAX_DISPLAY_COUNT);

  useEffect(() => {
    if (!galleryRef.current) return;

    const lightbox = new PhotoSwipeLightbox({
      dataSource: dataSources,
      pswpModule: photoswipe,
      bgOpacity: 1,
      secondaryZoomLevel: 2.5,
      maxZoomLevel: 20,
      zoom: false,
      close: sm,
    });

    // Add filename display
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
      pauseVideos();
    });

    // Link thumbnail element via thumbEl filter (for open/close animations)
    lightbox.addFilter("thumbEl", (thumbEl, data) => {
      const galleryEl = galleryRef.current;
      if (!galleryEl) return thumbEl!;

      // Return img element for both images and videos
      const mediaEl = galleryEl.querySelector<HTMLElement>(`[data-attachment="${data.attachmentId}"] img`);
      if (mediaEl) {
        return mediaEl;
      }
      return thumbEl!;
    });

    // Provide placeholder via placeholderSrc filter (for loading animation)
    lightbox.addFilter("placeholderSrc", (placeholderSrc, slide) => {
      if (slide.data.msrc) {
        return slide.data.msrc;
      }
      return placeholderSrc;
    });

    // Get actual media dimensions from DOM or data
    lightbox.addFilter("itemData", (itemData, index) => {
      const galleryEl = galleryRef.current;

      itemData.thumbCropped = true;

      if (itemData.type === "image") {
        // Try to get image dimensions from DOM
        if (galleryEl) {
          const el = galleryEl.querySelector(`[data-attachment="${itemData.attachmentId}"] img`);
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

        // If not in DOM (items after 9th), dynamically load to get dimensions
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
        // Auto-handle video dimensions
        if (itemData.msrc && !itemData.html?.includes("poster=")) {
          itemData.html = itemData.html?.replace("<media-theme-mini", `<media-theme-mini poster="${itemData.msrc}"`);
        }
      }

      return itemData;
    });

    // Note: Preloaded slides trigger contentLoad event
    // Note: Slide change event can be used to pause previous videos

    // content becomes active (the current slide)
    // can be default prevented
    lightbox.on("contentActivate", ({ content }) => {
      // Pause other videos
      pauseVideos({ id: content.data.attachmentId });

      if (content.type === "video") {
        // Wait for video element to be ready with reliable retry mechanism
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

  // Open lightbox when thumbnail is clicked
  // Use onPointerUp to avoid the first tap on iOS not being recognized
  const handleThumbnailClick = useCallback((index: number) => {
    if (lightboxRef.current) {
      pauseVideos();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => lightboxRef.current?.loadAndOpen(index));
      });
    }
  }, []);

  /**
   * Render image with useCallback to avoid recreation
   */
  const RenderImage = useCallback(
    ({ dataSource, index, len, remainingCount }: RenderMediaProps) => {
      const { type, original: attachment, attachmentUrl, attachmentId } = dataSource;
      const url = attachment.externalLink ? attachmentUrl : `${attachmentUrl}?thumbnail=true`;

      const layoutClass = {
        landscape: "col-span-2 aspect-[4/3]",
        portrait: "col-span-2 aspect-[3/4]",
        square: "col-span-2 aspect-square",
      };

      return (
        <LazyImage
          src={url}
          id={attachmentId}
          alt={dataSource.alt}
          filename={dataSource.filename}
          onClick={() => handleThumbnailClick(index)}
        >
          {({ containerRef, content, containerProps, dimensions }) => {
            return (
              <div
                ref={containerRef}
                {...containerProps}
                data-attachment={attachmentId}
                data-type={type}
                className={cn(
                  containerProps.className,
                  len === 1 && layoutClass[dimensions?.orientation || "square"],
                  len > 1 && "aspect-square",
                  extraClassMap[len]?.child,
                )}
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
   * Render video with useCallback to avoid recreation
   */
  const RenderVideo = useCallback(
    ({ dataSource, index, len, remainingCount }: RenderMediaProps) => {
      const { type, attachmentUrl, attachmentId } = dataSource;

      const layoutClass = {
        landscape: "col-span-3 aspect-video",
        portrait: "col-span-2 aspect-[3/4] [&_video]:object-cover [&_img.poster]:object-cover",
        square: "col-span-3 aspect-video",
      };

      return (
        <LazyVideo
          src={attachmentUrl}
          id={attachmentId}
          onLoad={(state) => {
            if (!dataSource.msrc && state.dimensions?.thumbnail) {
              dataSource.msrc = state.dimensions?.thumbnail;
            }
          }}
          onClick={() => handleThumbnailClick(index)}
        >
          {({ containerRef, content, containerProps, dimensions }) => {
            return (
              <div
                ref={containerRef}
                {...containerProps}
                data-attachment={attachmentId}
                data-type={type}
                className={cn(
                  containerProps.className,
                  len === 1 && (sm ? "col-span-3 aspect-video" : layoutClass[dimensions?.orientation || "square"]),
                  len > 1 && "aspect-square [&_video]:object-cover [&_img.poster]:object-cover",
                  extraClassMap[len]?.child,
                )}
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
          "grid gap-1.5 grid-cols-3 overflow-hidden sm:max-w-100",
          len === 1 && dataSources[0].type === "video" && "sm:max-w-160",
          extraClassMap[len]?.root,
        )}
      >
        {dataSources.slice(0, displayCount).map((dataSource, index) => {
          if (dataSource.type === "image") {
            return (
              <RenderImage key={dataSource.attachmentId} dataSource={dataSource} index={index} remainingCount={remainingCount} len={len} />
            );
          }
          if (dataSource?.type === "video") {
            return (
              <RenderVideo key={dataSource.attachmentId} dataSource={dataSource} index={index} remainingCount={remainingCount} len={len} />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
};

export default memo(MemoMediaList);
