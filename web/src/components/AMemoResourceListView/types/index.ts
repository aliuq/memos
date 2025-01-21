import { Resource } from "@/types/proto/api/v1/resource_service";

export interface MediaCardProps {
  length: number;
  resource: Resource;
  onClick?: () => void;
}

export interface VideoPreviewProps {
  resourceUrl: string;
  isCover: boolean;
  onClick?: () => void;
}

export interface LazyImageProps {
  src: string;
  alt?: string;
  className?: string;
  type?: "image" | "video";
  onLoad?: () => void;
  onClick?: () => void;
}

export interface GridViewProps {
  resources: Resource[];
  onSelect: (index: number) => void;
}
