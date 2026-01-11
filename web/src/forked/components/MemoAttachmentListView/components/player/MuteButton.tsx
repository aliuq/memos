import { Volume2, VolumeOff, VolumeX } from "lucide-react";
import { MediaActionTypes, useMediaDispatch, useMediaSelector } from "media-chrome/dist/react/media-store";
import { type ComponentType } from "react";
import IconButton, { IconButtonProps } from "./IconButton";

/** Volume levels that may be added in the future */
const VolumeLevel = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  OFF: "off",
} as const;

/** Map volume level to corresponding icon component */
const VolumeIconComponentMap: Record<string, ComponentType<any>> = {
  [VolumeLevel.HIGH]: Volume2,
  [VolumeLevel.MEDIUM]: VolumeX,
  [VolumeLevel.LOW]: VolumeX,
  [VolumeLevel.OFF]: VolumeOff,
  DEFAULT: VolumeOff,
};

/** Mute button with volume status indication */
const MuteButton = ({ className, ...rest }: Omit<IconButtonProps, "label">) => {
  const dispatch = useMediaDispatch();
  const mediaVolumeLevel = useMediaSelector((state) => state.mediaVolumeLevel);
  const mediaPseudoMuted = mediaVolumeLevel === VolumeLevel.OFF;
  const label = mediaPseudoMuted ? "Unmute" : "Mute";
  const IconComponent = VolumeIconComponentMap[mediaVolumeLevel ?? "DEFAULT"] ?? VolumeOff;

  return (
    <IconButton
      name="mute-button"
      label={label}
      ariaPressed={mediaPseudoMuted}
      className={className}
      onClick={() => {
        const type = mediaPseudoMuted ? MediaActionTypes.MEDIA_UNMUTE_REQUEST : MediaActionTypes.MEDIA_MUTE_REQUEST;
        dispatch({ type });
      }}
      {...rest}
    >
      <IconComponent />
    </IconButton>
  );
};

export default MuteButton;
