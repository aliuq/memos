import { useMediaRef, useMediaSelector } from "media-chrome/dist/react/media-store";
import React, { createElement, DetailedHTMLProps, ElementType, VideoHTMLAttributes } from "react";
import { cn } from "@/utils";

type VideoProps = DetailedHTMLProps<VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>;

export type PlayerVideoProps = VideoProps & {
  children?: React.ReactNode;
  className?: string;
  component?: ElementType<DetailedHTMLProps<VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>>;
};

const PlayerVideo = ({ className, children, component = "video", ...rest }: PlayerVideoProps) => {
  const mediaRef = useMediaRef();
  const mediaIsFullscreen = useMediaSelector((state) => state.mediaIsFullscreen);
  const mergeClassName = cn("size-full absolute inset-0 bg-black", className);
  const isIphone = /iPad|iPhone|iPod/i.test(navigator.userAgent.toLowerCase());

  const basicProps: VideoProps = {
    crossOrigin: "anonymous",
    playsInline: true,
    "webkit-playsinline": "true",
    preload: isIphone ? "metadata" : "auto",
    muted: false,
    autoPlay: false,
    "data-fullscreen": mediaIsFullscreen ? "true" : "false",
  } as VideoProps;

  return createElement(
    component,
    // @ts-expect-error data-* is not recognized
    { ref: mediaRef, className: mergeClassName, "data-slot": "player-video", ...basicProps, ...rest },
    children,
  );
};

export default PlayerVideo;
