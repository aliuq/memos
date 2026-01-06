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

export enum Orientation {
  /** 竖屏 */
  PORTRAIT = "portrait",
  /** 横屏 */
  LANDSCAPE = "landscape",
  /** 正方形 */
  SQUARE = "square",
}

type BaseResolution = {
  width: number;
  height: number;
  orientation: Orientation;
};
export type ImageResolution = BaseResolution & {
  type: "image";
  image?: ImageData;
  displayWidth?: number;
  displayHeight?: number;
  [key: string]: any;
};

export type VideoResolution = BaseResolution & {
  type: "video";
  thumbnail?: string;
  [key: string]: any;
};

export type ResourceResolution = ImageResolution | VideoResolution;
