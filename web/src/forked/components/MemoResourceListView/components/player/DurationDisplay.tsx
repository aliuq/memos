import { useMediaSelector, timeUtils } from "media-chrome/dist/react/media-store";
import { cn } from "@/lib/utils";
import IconButton, { type IconButtonProps } from "./IconButton";

const { formatTime } = timeUtils;

type DurationDisplayProps = IconButtonProps & {
  /** Show remaining time (countdown) or total duration */
  remaining?: boolean;
  /** Use absolute value to avoid negative sign when showing remaining time */
  abs?: boolean;
};

const DurationDisplay = ({ remaining = true, abs = false, className, ...rest }: DurationDisplayProps) => {
  const mediaCurrentTime = useMediaSelector((state) => state.mediaCurrentTime);
  const mediaDuration = useMediaSelector((state) => state.mediaDuration);

  const val = -((mediaDuration ?? 0) - (mediaCurrentTime ?? 0));

  return (
    <IconButton name="duration-display" className={cn("mx-2 cursor-default text-xs sm:text-sm", className)} {...rest}>
      {/**
       * Media Chrome's formatTime(seconds, guide) formats seconds and max duration to time string (e.g. "5:32").
       * Passing negative value displays as countdown (e.g. "-2:14").
       */}
      {remaining ? formatTime(abs ? Math.abs(val) : val, mediaDuration) : formatTime(mediaDuration ?? 0, mediaDuration)}
    </IconButton>
  );
};

export default DurationDisplay;
