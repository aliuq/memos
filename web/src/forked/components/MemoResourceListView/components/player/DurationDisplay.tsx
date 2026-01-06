import { useMediaSelector, timeUtils } from "media-chrome/dist/react/media-store";
import { cn } from "@/utils";
import IconButton, { type IconButtonProps } from "./IconButton";

const { formatTime } = timeUtils;

type DurationDisplayProps = IconButtonProps & {
  /** 是否显示剩余时间（倒计时），否则显示总时长 */
  remaining?: boolean;
  /** 当显示剩余时间时，是否取绝对值以避免出现负号 */
  abs?: boolean;
};

const DurationDisplay = ({ remaining = true, abs = false, className, ...rest }: DurationDisplayProps) => {
  const mediaCurrentTime = useMediaSelector((state) => state.mediaCurrentTime);
  const mediaDuration = useMediaSelector((state) => state.mediaDuration);

  const val = -((mediaDuration ?? 0) - (mediaCurrentTime ?? 0));

  return (
    <IconButton name="duration-display" className={cn("mx-2 cursor-default text-xs sm:text-sm", className)} {...rest}>
      {/**
       * Media Chrome 的 formatTime(seconds, guide) 会把秒数和最大时长格式化为时间字符串（例如 "5:32"）。
       * 传入负值会以倒计时形式显示（例如 "-2:14"）。
       */}
      {remaining ? formatTime(abs ? Math.abs(val) : val, mediaDuration) : formatTime(mediaDuration ?? 0, mediaDuration)}
    </IconButton>
  );
};

export default DurationDisplay;
