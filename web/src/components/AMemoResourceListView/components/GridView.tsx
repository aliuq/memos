import { memo } from "react";
import SquareDiv from "@/components/kit/SquareDiv";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { MediaCard } from "./MediaCard";

interface GridViewProps {
  resources: Resource[];
  onSelect: (index: number) => void;
}

export const GridView = memo(({ resources, onSelect }: GridViewProps) => {
  // 单张图片布局
  if (resources.length === 1) {
    return (
      <div className="w-full flex justify-center items-center border dark:border-zinc-800 rounded-xl overflow-hidden hide-scrollbar hover:shadow-md aspect-video">
        <MediaCard length={1} resource={resources[0]} onClick={() => onSelect(0)} />
      </div>
    );
  }

  // 4张图片的特殊布局
  if (resources.length === 4) {
    return (
      <div className="w-full grid grid-cols-2 gap-1">
        {resources.map((resource, index) => (
          <SquareDiv
            key={resource.name}
            className="group flex justify-center items-center border dark:border-zinc-900 rounded-xl overflow-hidden hide-scrollbar hover:shadow-md relative cursor-zoom-in"
          >
            <div className="w-full h-full">
              <MediaCard length={resources.length} resource={resource} onClick={() => onSelect(index)} />
            </div>
          </SquareDiv>
        ))}
      </div>
    );
  }

  // 其他数量的默认网格布局
  const displayCount = Math.min(resources.length, 9);
  const cards = resources.slice(0, displayCount).map((resource, index) => (
    <SquareDiv
      key={resource.name}
      className="group flex justify-center items-center border dark:border-zinc-900 rounded-xl overflow-hidden hide-scrollbar hover:shadow-md relative cursor-zoom-in"
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

  return <div className="w-full grid gap-1 grid-cols-3">{cards}</div>;
});

GridView.displayName = "GridView";
