import React, { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import "./hidden-content.css";

interface Props {
  content?: string;
  placeholder?: string;
  description?: string;
  "data-hidden-inline"?: string;
  "data-content"?: string;
  "data-placeholder"?: string;
  [key: string]: any;
}

const HiddenContentInline: React.FC<Props> = (props) => {
  const {
    content: contentProp,
    placeholder: placeholderProp,
    "data-content": dataContent,
    "data-placeholder": dataPlaceholder,
    className = "",
    ...rest
  } = props;

  // Merge props from both direct props and data attributes
  const content = contentProp || dataContent || "";
  const placeholder = placeholderProp || dataPlaceholder || "";

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
  const fmtContent = useMemo(() => content.trim(), [content]);
  const defaultText = placeholder || "内容已隐藏";

  const [show, setShow] = useState(false);

  const handleToggle = useCallback(() => {
    setShow((prev) => !prev);
  }, []);

  const hasContent = !!fmtContent;

  const computedClassName = useMemo(
    () =>
      cn(
        "inline-flex items-center border rounded-md align-baseline text-xs sm:text-sm ",
        "gap-1.25 px-1 sm:px-2 py-0.5 my-0.5",
        "cursor-default transition-all duration-300 ease-in-out transform-gpu",
        "bg-(--hidden-bg) border-(--hidden-border) text-(--hidden-foreground)",
        hasContent && "dark:hover:border-(--hidden-border-hover)",
        className,
      ),
    [hasContent, className],
  );

  return (
    <span className={computedClassName} onClick={hasContent ? handleToggle : undefined} {...filteredRest}>
      <span role="img" aria-label="hidden" className="select-none">
        {show ? "🔓" : "🔒"}
      </span>
      <span className="font-medium -ml-0.5">{show ? fmtContent : defaultText}</span>
    </span>
  );
};

export default HiddenContentInline;
