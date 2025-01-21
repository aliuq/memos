import { Play } from "lucide-react";
import { memo, useState, useEffect, useCallback } from "react";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { getResourceType, getResourceUrl } from "@/utils/resource";
import { useResourceContext } from "../context/ResourceContext";
import { getVideoThumbnail, thumbnailCache } from "../utils/thumbnailCache";
import { LazyImage } from "./LazyImage";

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

      getVideoThumbnail(resourceUrl)
        .then((thumbnail) => {
          setPosterUrl(thumbnail);
        })
        .catch(console.error);
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
      {type === "image/*" ? (
        <>
          <LazyImage className="object-cover size-full" src={`${resourceUrl}?thumbnail=true`} alt="" />
          <div
            className={`absolute inset-0 transition-colors duration-200 
              ${isActive ? "bg-black/10" : "bg-black/20 group-hover:bg-black/10"}`}
          />
        </>
      ) : (
        <div className="relative w-full h-full">
          <LazyImage className="object-cover" src={posterUrl || `${resourceUrl}?thumbnail=true`} alt="" />
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

ThumbnailItem.displayName = "ThumbnailItem";
