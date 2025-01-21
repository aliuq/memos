import { Component, ReactNode } from "react";

interface ResourceErrorBoundaryProps {
  children: ReactNode;
}

interface ResourceErrorBoundaryState {
  hasError: boolean;
}

export class ResourceErrorBoundary extends Component<ResourceErrorBoundaryProps, ResourceErrorBoundaryState> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div className="w-full h-full flex items-center justify-center text-red-500">资源加载失败</div>;
    }
    return this.props.children;
  }
}
