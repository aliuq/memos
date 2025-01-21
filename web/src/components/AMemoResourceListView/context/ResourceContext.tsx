import { createContext, useContext } from "react";
import { Resource } from "@/types/proto/api/v1/resource_service";

interface ResourceContextType {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  rotation: number;
  setRotation: (value: number | ((prev: number) => number)) => void;
  showVideo: boolean;
  setShowVideo: (value: boolean) => void;
  resources: Resource[];
}

const ResourceContext = createContext<ResourceContextType | null>(null);

export const useResourceContext = () => {
  const context = useContext(ResourceContext);
  if (!context) {
    throw new Error("useResourceContext must be used within ResourceProvider");
  }
  return context;
};

export const ResourceProvider = ResourceContext.Provider;
