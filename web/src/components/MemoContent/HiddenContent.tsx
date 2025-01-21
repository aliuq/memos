import React from "react";

interface Props {
  mode?: "inline" | "block";
  text?: string;
  description?: string;
  [key: string]: any; // 支持任意额外属性
}

const HiddenContent: React.FC<Props> = ({ mode = "inline", text = "", description = "" }) => {
  if (mode === "block") {
    return (
      <span className="block relative my-2 rounded-lg border border-teal-100/80 bg-teal-50/50 p-3 cursor-default transition-transform duration-150 ease-in active:scale-[0.98] dark:border-teal-950/30 dark:bg-teal-950/10">
        <span className="flex items-center gap-2">
          <span role="img" aria-label="hidden" className="text-lg text-teal-500/70 dark:text-teal-400/70">
            🔒
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-teal-700 dark:text-teal-300">{text || "此处内容已隐藏"}</span>
            <span className="text-xs text-teal-500 dark:text-teal-400/70">{description || "请联系管理员获取查看权限"}</span>
          </span>
        </span>
      </span>
    );
  }

  // 修改为 span 以避免嵌套问题
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 align-baseline text-[0.95em] rounded border border-teal-100/80 bg-teal-50/50 cursor-default transition-transform duration-150 ease-in active:scale-[0.98] dark:border-teal-950/30 dark:bg-teal-950/10">
      <span role="img" aria-label="hidden" className="text-[0.9em] text-teal-500/70 dark:text-teal-400/70">
        🔒
      </span>
      <span className="text-[0.9em] text-teal-700 dark:text-teal-300">{text || "内容已隐藏"}</span>
    </span>
  );
};

export default HiddenContent;
