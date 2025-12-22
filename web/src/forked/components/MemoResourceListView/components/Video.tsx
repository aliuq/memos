import { Play } from "lucide-react";
import { memo, useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { getResourceUrl } from "@/utils/resource";
import { useResourceContext } from "../context/ResourceContext";
import { getVideoThumbnail, thumbnailCache } from "../utils/thumbnailCache";
import { LazyImage } from "./LazyImage";

interface VideoPreviewProps {
  resourceUrl: string;
  isCover: boolean;
  from?: string;
  onClick?: () => void;
}

interface VideoPlayerProps {
  resource: Resource;
  autoPlay?: boolean;
  from?: string;
}

export const VideoPreview = memo(({ resourceUrl, isCover = true, onClick }: VideoPreviewProps) => {
  const [posterUrl, setPosterUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const loadThumbnail = async () => {
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

    return () => {
      mountedRef.current = false;
    };
  }, [resourceUrl]);

  return (
    <div className="relative w-full size-full" onClick={onClick}>
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-zinc-800">
          <div className="animate-pulse">Loading...</div>
        </div>
      ) : (
        <div className="absolute inset-0">
          <LazyImage
            type={isCover ? "image" : "video"}
            src={posterUrl || resourceUrl}
            alt="video thumbnail"
            className="w-full h-full object-cover"
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

export const VideoPlayer = memo(({ resource, autoPlay = false }: VideoPlayerProps) => {
  const { showVideo, setShowVideo } = useResourceContext();
  const videoRef = useRef<HTMLVideoElement>(null);
  const resourceUrl = getResourceUrl(resource);

  const posterUrl = useMemo(() => {
    return thumbnailCache.get(resourceUrl) || `${resourceUrl}?thumbnail=true`;
  }, [resourceUrl]);

  useEffect(() => {
    if (autoPlay) {
      setShowVideo(true);
    }
  }, [autoPlay, setShowVideo]);

  const handlePlay = useCallback(() => {
    setShowVideo(true);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch(console.error);
      }
    }, 0);
  }, [setShowVideo]);

  if (!showVideo) {
    return (
      <div className="relative w-full aspect-video bg-gray-100 dark:bg-zinc-800 cursor-pointer" onClick={handlePlay}>
        <LazyImage className="absolute inset-0 w-full h-full object-cover" type="video" src={posterUrl} alt="video thumbnail" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-100 hover:opacity-80 transition-opacity">
          <div className="p-4 rounded-full bg-black/50 text-white">
            <Play size={32} className="fill-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full aspect-video bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        src={resourceUrl}
        poster={posterUrl}
        controls
        autoPlay
        onEnded={() => setShowVideo(false)}
      />
    </div>
  );
});

VideoPreview.displayName = "VideoPreview";
VideoPlayer.displayName = "VideoPlayer";
