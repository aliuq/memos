import { memo, useMemo } from "react";
import MemoResource from "@/components/MemoResource";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { getResourceType } from "@/utils/resource";
import GridView from "./components/GridView";

// 提取为独立组件避免每次渲染重新创建
const OtherList = memo(({ resources }: { resources: Resource[] }) => {
  if (resources.length === 0) return null;

  return (
    <div className="w-full flex flex-row justify-start overflow-auto gap-2">
      {resources.map((resource) => (
        <MemoResource key={resource.name} resource={resource} />
      ))}
    </div>
  );
});

const MemoResourceListView = ({ resources = [] }: { resources: Resource[] }) => {
  // 使用 useMemo 缓存资源分类计算，避免每次渲染都重新计算
  const { mediaResources, otherResources } = useMemo(() => {
    const media: Resource[] = [];
    const other: Resource[] = [];

    resources.forEach((resource) => {
      const type = getResourceType(resource);
      if (type === "image/*" || type === "video/*") {
        media.push(resource);
      } else {
        other.push(resource);
      }
    });

    return { mediaResources: media, otherResources: other };
  }, [resources]);

  return (
    <>
      {mediaResources.length > 0 && <GridView resources={mediaResources} />}
      <OtherList resources={otherResources} />
    </>
  );
};

export default memo(MemoResourceListView);
