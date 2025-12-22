import { useState, useEffect } from "react";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { getResourceType, getResourceUrl } from "@/utils/resource";

export const useImageProgress = (resources: Resource[]) => {
  const [resourceLoadProgress, setResourceLoadProgress] = useState(0);

  useEffect(() => {
    let loaded = 0;
    const total = resources.length;

    const updateProgress = () => {
      loaded++;
      setResourceLoadProgress((loaded / total) * 100);
    };

    resources.forEach((resource) => {
      if (getResourceType(resource) === "image/*") {
        const img = new Image();
        img.onload = updateProgress;
        img.onerror = updateProgress;
        img.src = getResourceUrl(resource);
      } else {
        updateProgress();
      }
    });
  }, [resources]);

  return resourceLoadProgress;
};
