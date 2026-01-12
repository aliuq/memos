import React, { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import "./hidden-content.css";

interface Props {
  children?: React.ReactNode;
  placeholder?: string;
  description?: string;
  "data-hidden-block"?: string;
  "data-placeholder"?: string;
  "data-description"?: string;
  [key: string]: any;
}

const HiddenContentBlock: React.FC<Props> = (props) => {
  const {
    children,
    placeholder: placeholderProp,
    description: descriptionProp,
    "data-placeholder": dataPlaceholder,
    "data-description": dataDescription,
    className = "",
    ...rest
  } = props;

  // Merge props from both direct props and data attributes
  const placeholder = placeholderProp || dataPlaceholder || "";
  const description = descriptionProp || dataDescription || "";

  // Filter out data attributes from rest
  const filteredRest = Object.keys(rest).reduce(
    (acc, key) => {
      if (!key.startsWith("data-")) {
        acc[key] = rest[key];
      }
      return acc;
    },
    {} as Record<string, any>,
  );
  const defaultPlaceholder = placeholder || "此处内容已隐藏";
  const defaultDescription = description || "请联系管理员获取查看权限";
  const childrenArray = React.Children.toArray(children);
  const hasContent = childrenArray.length > 0;

  const [show, setShow] = useState(false);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShow((prev) => !prev);
  }, []);

  const computedClassName = useMemo(
    () =>
      cn(
        "block rounded-md overflow-hidden border cursor-default",
        "transition-all duration-300 ease-in-out transform-gpu",
        "px-2 sm:px-3 py-3 sm:py-4 my-0.5",
        "border-(--hidden-border) bg-(--hidden-bg) text-(--hidden-foreground)",
        className,
      ),
    [className],
  );

  const renderedChildren = useMemo(() => (show && hasContent ? childrenArray : null), [show, hasContent, childrenArray]);

  const placeholderContent = useMemo(
    () => (
      <span className="flex items-start gap-3">
        <span role="img" aria-label="hidden" className="text-2xl shrink-0 transition-transform duration-300">
          {show ? "🔓" : "🔒"}
        </span>

        <span className="flex flex-col gap-1 flex-1">
          <span className="text-lg font-medium tracking-tight">{defaultPlaceholder}</span>
          <span className="text-sm leading-relaxed text-(--hidden-foreground-2)">{defaultDescription}</span>
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
      ...filteredRest,
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

export default HiddenContentBlock;
