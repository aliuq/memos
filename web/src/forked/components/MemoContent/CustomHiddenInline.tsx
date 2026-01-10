import React, { useState, useCallback, useMemo } from "react";
import { BaseProps } from "@/components/MemoContent/types";
import { cn } from "@/lib/utils";
import "./hidden-content.css";

interface Props extends BaseProps {
  content?: string;
  placeholder?: string;
  description?: string;
}

const CustomHiddenInline: React.FC<Props> = ({ content = "", placeholder = "", className = "", ...rest }) => {
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
    <span className={computedClassName} onClick={hasContent ? handleToggle : undefined} {...rest}>
      <span role="img" aria-label="hidden" className="select-none">
        {show ? "🔓" : "🔒"}
      </span>
      <span className="font-medium -ml-0.5">{show ? fmtContent : defaultText}</span>
    </span>
  );
};

export default CustomHiddenInline;
