import { memo } from "react";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { getResourceType, getResourceUrl } from "@/utils/resource";
import { LazyImage } from "./LazyImage";
import { VideoPreview } from "./VideoPreview";

interface MediaCardProps {
  length: number;
  resource: Resource;
  onClick?: () => void;
}

export const MediaCard = memo(({ length, resource, onClick }: MediaCardProps) => {
  const type = getResourceType(resource);
  const resourceUrl = getResourceUrl(resource);

  if (type === "image/*") {
    return (
      <LazyImage
        className="object-cover size-full hover:opacity-90 transition-opacity"
        src={resource.externalLink ? resourceUrl : resourceUrl + "?thumbnail=true"}
        onClick={onClick}
      />
    );
  }

  if (type === "video/*") {
    return <VideoPreview isCover={length > 1} resourceUrl={resourceUrl} onClick={onClick} />;
  }

  return null;
});

MediaCard.displayName = "MediaCard";
