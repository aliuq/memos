import { cn } from "@/utils";

export function RenderMediaState({
  className,
  IconComponent,
  text,
  children,
}: {
  className?: string;
  IconComponent?: React.ComponentType<{ className?: string }>;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("absolute inset-0 bg-gray-100 dark:bg-zinc-700 transition-all", className)}>
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center ",
          "[&_svg]:size-9 [&_svg]:text-gray-300 dark:[&_svg]:text-zinc-600 ",
          "[&_p]:mt-2 [&_p]:text-xs [&_p]:text-gray-500 dark:[&_p]:text-zinc-500",
        )}
      >
        {IconComponent && <IconComponent />}
        {text && <p>{text}</p>}
        {children}
      </div>
    </div>
  );
}

export default RenderMediaState;
