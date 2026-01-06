import { VolumeOff, Volume2, VolumeX } from "lucide-react";
import { MediaActionTypes, useMediaDispatch, useMediaSelector } from "media-chrome/dist/react/media-store";
import { type ComponentType } from "react";
import IconButton, { IconButtonProps } from "./IconButton";

/** 将来可能会添加的音量级别 */
const VolumeLevel = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  OFF: "off",
} as const;

/** 根据音量级别映射到对应的图标组件 */
const VolumeIconComponentMap: Record<string, ComponentType<any>> = {
  [VolumeLevel.HIGH]: Volume2,
  [VolumeLevel.MEDIUM]: VolumeX,
  [VolumeLevel.LOW]: VolumeX,
  [VolumeLevel.OFF]: VolumeOff,
  DEFAULT: VolumeOff,
};

/** 带有音量状态提示的静音按钮 */
const MuteButton = ({ className, ...rest }: Omit<IconButtonProps, "label">) => {
  const dispatch = useMediaDispatch();
  const mediaVolumeLevel = useMediaSelector((state) => state.mediaVolumeLevel);
  const mediaPseudoMuted = mediaVolumeLevel === VolumeLevel.OFF;
  const label = mediaPseudoMuted ? "取消静音" : "静音";
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
