import { Pause, Play } from "lucide-react";
import { useMediaDispatch, useMediaSelector, MediaActionTypes } from "media-chrome/dist/react/media-store";
import { cn } from "@/lib/utils";
import IconButton, { IconButtonProps } from "./IconButton";

const PlayBigButton = ({ className, center = false, ...rest }: Omit<IconButtonProps, "label"> & { center?: boolean }) => {
  const dispatch = useMediaDispatch();
  const mediaPaused = useMediaSelector((state) => typeof state.mediaPaused !== "boolean" || state.mediaPaused);
  const IconComponent = mediaPaused ? Play : Pause;
  const label = mediaPaused ? "Play" : "Pause";

  // Pause other videos when playing
  function togglePlay(e: React.MouseEvent) {
    e.stopPropagation();

    if (mediaPaused) {
      const videos = document.querySelectorAll("video");
      videos.forEach((video) => {
        if (!video.paused) {
          video.pause();
        }
      });
    }

    const type = mediaPaused ? MediaActionTypes.MEDIA_PLAY_REQUEST : MediaActionTypes.MEDIA_PAUSE_REQUEST;
    dispatch({ type });
  }

  return (
    <IconButton
      name="play-big-button"
      label={label}
      rounded={false}
      className={cn("[&_svg]:!size-8", center && "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2", className)}
      onClick={togglePlay}
      {...rest}
    >
      <IconComponent className="fill-white" />
    </IconButton>
  );
};

export default PlayBigButton;
