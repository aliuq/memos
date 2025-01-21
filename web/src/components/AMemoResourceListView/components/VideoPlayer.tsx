import { Play } from "lucide-react";
import { memo, useRef, useEffect, useCallback, useMemo } from "react";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { getResourceUrl } from "@/utils/resource";
import { useResourceContext } from "../context/ResourceContext";
import { thumbnailCache } from "../utils/thumbnailCache";
import { LazyImage } from "./LazyImage";

interface VideoPlayerProps {
  resource: Resource;
  autoPlay?: boolean;
}

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
    // 确保视频立即播放
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch(console.error);
      }
    }, 0);
  }, [setShowVideo]);

  if (!showVideo) {
    return (
      <div className="relative w-full aspect-video cursor-pointer" onClick={handlePlay}>
        <LazyImage className="absolute inset-0 object-contain" src={posterUrl} alt="video thumbnail" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-100 hover:opacity-80 transition-opacity">
          <div className="p-4 rounded-full bg-black/50 text-white">
            <Play size={32} className="fill-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full sm:aspect-video bg-black">
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

VideoPlayer.displayName = "VideoPlayer";
