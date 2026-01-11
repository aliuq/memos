import { MediaActionTypes, useMediaDispatch, useMediaSelector } from "media-chrome/dist/react/media-store";

const FullscreenGestureRegion = ({
  className,
  autoPlay = true,
  muted = true,
}: {
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
}) => {
  const dispatch = useMediaDispatch();
  const mediaIsFullscreen = useMediaSelector((state) => state.mediaIsFullscreen);
  const mediaPaused = useMediaSelector((state) => typeof state.mediaPaused !== "boolean" || state.mediaPaused);
  const mediaVolumeLevel = useMediaSelector((state) => state.mediaVolumeLevel);
  const mediaPseudoMuted = mediaVolumeLevel === "off";

  return (
    <div
      className={className}
      onClick={() => {
        const type = mediaIsFullscreen ? MediaActionTypes.MEDIA_EXIT_FULLSCREEN_REQUEST : MediaActionTypes.MEDIA_ENTER_FULLSCREEN_REQUEST;
        dispatch({ type });
        if (mediaIsFullscreen) {
          dispatch({ type: MediaActionTypes.MEDIA_PAUSE_REQUEST });
        } else {
          if (muted && mediaPseudoMuted) {
            dispatch({ type: MediaActionTypes.MEDIA_UNMUTE_REQUEST });
          }
          if (autoPlay && mediaPaused) {
            dispatch({ type: MediaActionTypes.MEDIA_PLAY_REQUEST });
          }
        }
      }}
    ></div>
  );
};

export default FullscreenGestureRegion;
