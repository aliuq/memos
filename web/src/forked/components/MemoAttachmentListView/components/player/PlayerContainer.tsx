import { useMediaFullscreenRef } from "media-chrome/dist/react/media-store";
import { cn } from "@/lib/utils";

interface PlayerContainerProps {
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

const PlayerContainer = ({ children, className, onClick }: PlayerContainerProps) => {
  const mediaFullscreenRef = useMediaFullscreenRef();
  const mergeClassName = cn("relative size-full bg-black overflow-hidden cursor-default", className);

  return (
    <div data-slot="player-container" ref={mediaFullscreenRef} className={mergeClassName} onClick={onClick}>
      {children}
    </div>
  );
};

export default PlayerContainer;
