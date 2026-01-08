import { useMediaSelector } from "media-chrome/dist/react/media-store";
import { useState } from "react";
import DurationDisplay from "./DurationDisplay";
import PlayBigButton from "./PlayBigButton";
import Seekbar from "./Seekbar";
import TogglePausedGestureRegion from "./TogglePausedGestureRegion";

const ControlsContainer = () => {
  const mediaPaused = useMediaSelector((state) => typeof state.mediaPaused !== "boolean" || state.mediaPaused);

  const MobileControls = () => {
    const [userActive, setUserActive] = useState(false);
    const mediaIsFullscreen = useMediaSelector((state) => state.mediaIsFullscreen);
    return (
      <div
        onMouseMove={() => setUserActive(true)}
        onMouseLeave={() => setUserActive(false)}
        onBlur={() => setUserActive(false)}
        className="absolute inset-0 size-full flex flex-col gap-5 select-none"
      >
        <div className={`relative flex-1 flex w-full`}>
          <TogglePausedGestureRegion className="absolute h-full shrink-0 grow-0 w-[30%] left-1/2 -translate-x-1/2" />
        </div>

        <div className={`w-full ${mediaIsFullscreen ? "h-[100px]" : "h-5"}`}>
          <PlayBigButton center className={`${mediaPaused || userActive ? "opacity-100" : "opacity-0"}`} />
          <DurationDisplay
            abs
            className={`absolute w-10 inline-block text-right right-0 ${mediaIsFullscreen ? "bottom-7" : "bottom-2.5"}`}
          />
          <div
            className={`absolute inset-x-0 bottom-0 transition-all transform duration-500 ease-in-out ${
              mediaPaused || userActive ? "-translate-y-[1px]" : "translate-y-[1px]"
            } ${mediaIsFullscreen ? "py-4" : ""}`}
          >
            <Seekbar disabled={!mediaIsFullscreen} />
          </div>
        </div>
      </div>
    );
  };

  return <MobileControls />;
};

export default ControlsContainer;
