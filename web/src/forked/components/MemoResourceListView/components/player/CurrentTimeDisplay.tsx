import { useMediaSelector, timeUtils } from "media-chrome/dist/react/media-store";
import { cn } from "@/utils";
import IconButton, { type IconButtonProps } from "./IconButton";

const { formatTime } = timeUtils;

const CurrentTimeDisplay = ({ className, ...rest }: IconButtonProps) => {
  const mediaCurrentTime = useMediaSelector((state) => state.mediaCurrentTime);
  const [, seekableEnd] = useMediaSelector((state) => state.mediaSeekable) ?? [];

  return (
    <IconButton name="current-time" className={cn("mx-2 cursor-default text-xs sm:text-sm", className)} {...rest}>
      {formatTime(mediaCurrentTime ?? 0, seekableEnd)}
    </IconButton>
  );
};

export default CurrentTimeDisplay;
