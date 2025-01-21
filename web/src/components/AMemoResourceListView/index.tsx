import { memo, useState, useMemo } from "react";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { getResourceType } from "@/utils/resource";
import MemoResource from "../MemoResource";
import { ExpandedView } from "./components/ExpandedView";
import { GridView } from "./components/GridView";
import { ResourceErrorBoundary } from "./components/ResourceErrorBoundary";
import { ResourceProvider } from "./context/ResourceContext";

const MemoResourceListView = ({ resources = [] }: { resources: Resource[] }) => {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [rotation, setRotation] = useState(0);
  const [showVideo, setShowVideo] = useState(false);

  const mediaResources = useMemo(() => {
    return resources.filter((resource) => {
      const type = getResourceType(resource);
      return type === "image/*" || type === "video/*";
    });
  }, [resources]);

  const otherResources = useMemo(() => {
    return resources.filter((resource) => {
      const type = getResourceType(resource);
      return type !== "image/*" && type !== "video/*";
    });
  }, [resources]);

  const contextValue = useMemo(
    () => ({
      activeIndex,
      setActiveIndex,
      rotation,
      setRotation,
      showVideo,
      setShowVideo,
      resources: mediaResources,
    }),
    [activeIndex, rotation, showVideo, mediaResources],
  );

  return (
    <ResourceErrorBoundary>
      <ResourceProvider value={contextValue}>
        <div className="w-full flex flex-col gap-4">
          {activeIndex >= 0 ? (
            <ResourceErrorBoundary>
              <ExpandedView />
            </ResourceErrorBoundary>
          ) : (
            <div className={resources.length === 1 ? "w-full" : "w-full sm:w-[400px]"}>
              <ResourceErrorBoundary>
                <GridView resources={mediaResources} onSelect={setActiveIndex} />
              </ResourceErrorBoundary>
            </div>
          )}

          {otherResources.length > 0 && (
            <div className="w-full flex flex-row flex-wrap gap-2">
              {otherResources.map((resource) => (
                <ResourceErrorBoundary key={resource.name}>
                  <MemoResource resource={resource} />
                </ResourceErrorBoundary>
              ))}
            </div>
          )}
        </div>
      </ResourceProvider>
    </ResourceErrorBoundary>
  );
};

export default memo(MemoResourceListView);
