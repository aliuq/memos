import { Play } from "lucide-react";
import { memo, useState, useRef, useEffect } from "react";
import { getVideoThumbnail, thumbnailCache } from "../utils/thumbnailCache";
import { LazyImage } from "./LazyImage";

interface VideoPreviewProps {
  resourceUrl: string;
  isCover: boolean;
  onClick?: () => void;
}

export const VideoPreview = memo(({ resourceUrl, isCover = true, onClick }: VideoPreviewProps) => {
  const [posterUrl, setPosterUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const loadThumbnail = async () => {
      // 检查缓存
      if (thumbnailCache.has(resourceUrl)) {
        setPosterUrl(thumbnailCache.get(resourceUrl)!);
        return;
      }

      try {
        setIsLoading(true);
        const thumbnail = await getVideoThumbnail(resourceUrl);
        if (mountedRef.current) {
          setPosterUrl(thumbnail);
        }
      } catch (error) {
        console.error("Failed to load video thumbnail:", error);
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    loadThumbnail();

    // 清理函数
    return () => {
      mountedRef.current = false;
    };
  }, [resourceUrl]);

  return (
    <div className="relative w-full h-full group cursor-pointer" onClick={onClick}>
      {isLoading ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-zinc-800">
          <div className="animate-pulse">Loading...</div>
        </div>
      ) : (
        <div className="w-full h-full">
          <LazyImage
            className="w-full h-full"
            type={isCover ? "image" : "video"}
            src={posterUrl || `${resourceUrl}?thumbnail=true`}
            alt="video thumbnail"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-75 group-hover:opacity-100 transition-opacity">
            <div className="p-2 rounded-full bg-black/50 text-white">
              <Play size={24} className="fill-white" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

VideoPreview.displayName = "VideoPreview";
