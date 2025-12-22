import React, { useState, useCallback, useMemo } from "react";
import { BaseProps } from "@/components/MemoContent/types";
import { cn } from "@/utils";

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
        "inline-flex items-center gap-[5px] px-2 py-0.5 my-0.5 align-baseline text-[0.92em] rounded-md",
        "cursor-default transition-all duration-300 ease-in-out transform-gpu",
        "border border-warning/30 dark:border-warning/20 bg-warning/5 dark:bg-warning/10",
        "text-warning-dark dark:text-warning/90",
        hasContent ? "dark:hover:border-warning/40" : "",
        className,
      ),
    [hasContent, className],
  );

  return (
    <span className={computedClassName} onClick={hasContent ? handleToggle : undefined} {...rest}>
      <span role="img" aria-label="hidden" className="text-[0.95em] select-none">
        {show ? "🔓" : "🔒"}
      </span>
      <span className="text-[0.92em] font-medium">{show ? fmtContent : defaultText}</span>
    </span>
  );
};

export default CustomHiddenInline;
