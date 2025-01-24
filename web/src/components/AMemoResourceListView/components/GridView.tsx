import { memo } from "react";
import SquareDiv from "@/components/kit/SquareDiv";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { getResourceType } from "@/utils/resource";
import { MediaCard } from "./MediaCard";

interface GridViewProps {
  resources: Resource[];
  onSelect: (index: number) => void;
}

export const GridView = memo(({ resources, onSelect }: GridViewProps) => {
  // 单张资源布局
  if (resources.length === 1) {
    const type = getResourceType(resources[0]);
    const isImage = type === "image/*";

    return (
      <div
        className={`flex justify-center items-center border dark:border-zinc-800 overflow-hidden hide-scrollbar hover:shadow-md ${
          isImage ? "w-full sm:w-2/5 max-h-[400px] cursor-zoom-in" : "w-full aspect-video cursor-pointer"
        }`}
      >
        <MediaCard length={1} resource={resources[0]} onClick={() => onSelect(0)} />
      </div>
    );
  }

  // 2-4 张资源布局
  if (resources.length >= 2 && resources.length <= 4) {
    return (
      <div className="w-full grid gap-1 grid-cols-2 sm:grid-cols-4">
        {resources.map((resource, index) => (
          <SquareDiv
            key={resource.name}
            className="group flex justify-center items-center border dark:border-zinc-900 overflow-hidden hide-scrollbar hover:shadow-md relative cursor-zoom-in"
          >
            <div className="w-full h-full">
              <MediaCard length={resources.length} resource={resource} onClick={() => onSelect(index)} />
            </div>
          </SquareDiv>
        ))}
      </div>
    );
  }

  // 5-8 张资源布局
  if (resources.length >= 5 && resources.length <= 8) {
    return (
      <div className="w-full grid gap-1 grid-cols-3 sm:grid-cols-4">
        {resources.map((resource, index) => (
          <SquareDiv
            key={resource.name}
            className="group flex justify-center items-center border dark:border-zinc-900 overflow-hidden hide-scrollbar hover:shadow-md relative cursor-zoom-in"
          >
            <div className="w-full h-full">
              <MediaCard length={resources.length} resource={resource} onClick={() => onSelect(index)} />
            </div>
          </SquareDiv>
        ))}
      </div>
    );
  }

  // 9张及以上保持九宫格布局
  const displayCount = Math.min(resources.length, 9);
  const cards = resources.slice(0, displayCount).map((resource, index) => (
    <SquareDiv
      key={resource.name}
      className="group flex justify-center items-center border dark:border-zinc-900 overflow-hidden hide-scrollbar hover:shadow-md relative cursor-zoom-in"
    >
      <div className="w-full h-full">
        <MediaCard length={resources.length} resource={resource} onClick={() => onSelect(index)} />
      </div>
      {index === displayCount - 1 && resources.length > 9 && (
        <div
          className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center cursor-zoom-in hover:bg-black/60 transition-colors"
          onClick={() => onSelect(index)}
        >
          <span className="text-white text-xl font-bold">+{resources.length - 9}</span>
        </div>
      )}
    </SquareDiv>
  ));

  return <div className="w-full sm:w-[400px] grid gap-1 grid-cols-3">{cards}</div>;
});

GridView.displayName = "GridView";
