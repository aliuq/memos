import { MinimizeIcon, ZoomInIcon } from "lucide-react";
import { memo, useCallback, useState, useMemo, useEffect } from "react";
import showPreviewImageDialog from "@/components/PreviewImageDialog";
import { getResourceType, getResourceUrl } from "@/utils/resource";
import { useResourceContext } from "../context/ResourceContext";
import { LazyImage } from "./LazyImage";
import { ThumbnailList } from "./Thumbnail";
import { VideoPlayer } from "./Video";

export const ExpandedView = memo(() => {
  const { resources, activeIndex, setActiveIndex, setRotation, setShowVideo } = useResourceContext();
  const activeResource = resources[activeIndex];
  const resourceUrl = getResourceUrl(activeResource);
  const type = getResourceType(activeResource);
  const isSingleVideo = resources.length === 1 && type === "video/*";
  const isSinglePhoto = resources.length === 1 && type === "image/*";
  const [cursorArea, setCursorArea] = useState<"left" | "center" | "right" | null>(null);

  const handleAreaClick = useCallback(
    (e: React.MouseEvent) => {
      if (type !== "image/*") return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const isLeftArea = x < width / 3;
      const isRightArea = x > (width * 2) / 3;

      if (isLeftArea) {
        if (activeIndex === 0) {
          setActiveIndex(-1);
        } else {
          setActiveIndex(activeIndex - 1);
        }
      } else if (isRightArea) {
        if (activeIndex === resources.length - 1) {
          setActiveIndex(-1);
        } else {
          setActiveIndex(activeIndex + 1);
        }
      } else {
        setActiveIndex(-1);
      }
    },
    [type, activeIndex, resources.length, setActiveIndex],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (type !== "image/*") return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;

      if (x < width / 3) {
        setCursorArea("left");
      } else if (x > (width * 2) / 3) {
        setCursorArea("right");
      } else {
        setCursorArea("center");
      }
    },
    [type],
  );

  const handleCollapse = useCallback(() => {
    setActiveIndex(-1);
    setShowVideo(false);
    setRotation(0);
  }, [setActiveIndex, setShowVideo, setRotation]);

  const handlePreview = useCallback(() => {
    const imgUrls = resources.filter((resource) => getResourceType(resource) === "image/*").map((resource) => getResourceUrl(resource));
    showPreviewImageDialog(imgUrls, activeIndex);
  }, [resources, activeIndex]);

  const cursorStyle = useMemo(() => {
    if (!cursorArea) return {};

    const isLeft = cursorArea === "left";
    const isRight = cursorArea === "right";
    const showCollapse = (isLeft && activeIndex === 0) || (isRight && activeIndex === resources.length - 1);

    if (cursorArea === "center" || showCollapse) {
      return { cursor: "zoom-out" };
    }

    const svg = isLeft
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;

    return { cursor: `url('data:image/svg+xml,${encodeURIComponent(svg)}') 16 16, pointer` };
  }, [cursorArea, activeIndex, resources.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeIndex === -1) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          if (activeIndex > 0) setActiveIndex(activeIndex - 1);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (activeIndex < resources.length - 1) setActiveIndex(activeIndex + 1);
          break;
        case "Escape":
          e.preventDefault();
          handleCollapse();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, resources.length, handleCollapse, setActiveIndex]);

  return (
    <div className="w-full flex flex-col">
      {/* 主视图区域 */}
      <div className="w-full flex rounded-xl overflow-hidden justify-center items-center relative">
        {/* 功能按钮组 */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-10">
          <button
            className="p-2 rounded-lg bg-black/50 hover:bg-black/60 text-white backdrop-blur transition-colors"
            onClick={handleCollapse}
          >
            <MinimizeIcon className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            {/* 索引显示 */}
            {resources.length > 1 && (
              <div className="px-2 py-1 rounded-lg bg-black/50 backdrop-blur text-white text-sm">
                {activeIndex + 1}/{resources.length}
              </div>
            )}

            {/* 查看大图按钮 */}
            {type !== "video/*" && (
              <button
                className="p-2 rounded-lg bg-black/50 hover:bg-black/60 text-white backdrop-blur transition-colors"
                onClick={handlePreview}
              >
                <ZoomInIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* 图片/视频显示区域 */}
        {type === "image/*" ? (
          <div
            className="relative w-full flex justify-center select-none"
            onClick={handleAreaClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setCursorArea(null)}
            style={cursorStyle}
          >
            <LazyImage src={resourceUrl} alt="" className="w-full" />
          </div>
        ) : (
          <VideoPlayer resource={activeResource} autoPlay={isSingleVideo} />
        )}
      </div>

      {/* 缩略图列表 */}
      {!isSingleVideo && !isSinglePhoto && <ThumbnailList />}
    </div>
  );
});

ExpandedView.displayName = "ExpandedView";
