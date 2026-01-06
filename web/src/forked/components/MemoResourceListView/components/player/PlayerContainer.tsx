import { useMediaFullscreenRef } from "media-chrome/dist/react/media-store";
import { cn } from "@/utils";

interface PlayerContainerProps {
  children: React.ReactNode;
  className?: string;
}

const PlayerContainer = ({ children, className }: PlayerContainerProps) => {
  const mediaFullscreenRef = useMediaFullscreenRef();
  const mergeClassName = cn("relative size-full bg-black overflow-hidden cursor-default", className);

  return (
    <div data-slot="player-container" ref={mediaFullscreenRef} className={mergeClassName}>
      {children}
    </div>
  );
};

export default PlayerContainer;
