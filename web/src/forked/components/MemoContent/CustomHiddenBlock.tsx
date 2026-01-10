import React, { useState, useCallback, useMemo } from "react";
import Renderer from "@/components/MemoContent/Renderer";
import { BaseProps } from "@/components/MemoContent/types";
import { cn } from "@/lib/utils";
import { Node } from "@/types/proto/api/v1/markdown_service";

interface Props extends BaseProps {
  children: Node[];
  placeholder?: string;
  description?: string;
}

const CustomHiddenBlock: React.FC<Props> = ({ children, placeholder = "", description = "", className = "", ...rest }) => {
  const defaultPlaceholder = placeholder || "此处内容已隐藏";
  const defaultDescription = description || "请联系管理员获取查看权限";
  const hasContent = children?.length > 0;

  const [show, setShow] = useState(false);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShow((prev) => !prev);
  }, []);

  const computedClassName = useMemo(
    () =>
      cn(
        "block rounded-md overflow-hidden px-2 sm:px-3 py-3 sm:py-4 my-0.5 cursor-default transition-all duration-300 ease-in-out",
        "border border-warning/30 dark:border-warning/20 bg-warning/5 dark:bg-warning/10",
        className,
      ),
    [className],
  );

  const renderedChildren = useMemo(
    () =>
      show && hasContent
        ? children.map((child, index) => (
            <Renderer key={`${child.type}-${JSON.stringify(child).slice(0, 20)}-${index}`} index={String(index)} node={child} />
          ))
        : null,
    [show, hasContent, children],
  );

  const placeholderContent = useMemo(
    () => (
      <span className="flex items-start gap-3">
        <span
          role="img"
          aria-label="hidden"
          className="text-2xl flex-shrink-0 text-warning-dark/70 dark:text-warning/90 transition-transform duration-300"
        >
          {show ? "🔓" : "🔒"}
        </span>

        <span className="flex flex-col gap-1 flex-1">
          <span className="text-lg font-medium tracking-tight text-warning dark:text-warning/70">{defaultPlaceholder}</span>
          <span className="text-sm leading-relaxed text-warning/70 dark:text-warning/60">{defaultDescription}</span>
        </span>
      </span>
    ),
    [show, defaultPlaceholder, defaultDescription],
  );

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return React.createElement(
    hasContent ? "div" : "span",
    {
      className: computedClassName,
      onClick: hasContent ? handleToggle : undefined,
      ...rest,
    },
    [
      hasContent && (
        <div key="content" className={cn("transition-all duration-300 ease-in-out", show ? "mb-4" : "mb-0")} onClick={handleContentClick}>
          {renderedChildren}
        </div>
      ),

      (!hasContent || !show) && <React.Fragment key="placeholder">{placeholderContent}</React.Fragment>,
    ],
  );
};

export default CustomHiddenBlock;
