import { useMediaDispatch, useMediaSelector, MediaActionTypes } from "media-chrome/dist/react/media-store";

const TogglePausedGestureRegion = ({ className }: { className?: string }) => {
  const dispatch = useMediaDispatch();
  const mediaPaused = useMediaSelector((state) => typeof state.mediaPaused !== "boolean" || state.mediaPaused);

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

  return <div className={className} onClick={togglePlay}></div>;
};

export default TogglePausedGestureRegion;
