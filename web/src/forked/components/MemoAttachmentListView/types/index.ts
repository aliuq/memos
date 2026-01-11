import { Attachment } from "@/types/proto/api/v1/attachment_service";

export interface MediaCardProps {
  length: number;
  attachment: Attachment;
  onClick?: () => void;
}

export interface VideoPreviewProps {
  attachmentUrl: string;
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
  attachments: Attachment[];
  onSelect: (index: number) => void;
}

export enum Orientation {
  /** Portrait 竖屏 */
  PORTRAIT = "portrait",
  /** Landscape 横屏 */
  LANDSCAPE = "landscape",
  /** Square 正方形 */
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

export type AttachmentResolution = ImageResolution | VideoResolution;
