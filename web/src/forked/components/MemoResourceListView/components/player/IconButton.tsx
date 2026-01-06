import { cn } from "@/utils";

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  name?: string;
  label?: string;
  ariaPressed?: boolean;
  baseClassName?: string;
  rounded?: boolean;
};

const IconButton = ({ name, label, ariaPressed, baseClassName, className, children, rounded = false, ...rest }: IconButtonProps) => {
  const mergeClassName = cn(
    // Reset button styles
    "appearance-none bg-transparent border-0 p-0 m-0 text-inherit font-inherit leading-inherit rounded-none shadow-none focus:outline-none",
    "flex items-center justify-center text-white transition-all duration-300 ease-in-out outline-none select-none",
    "[&_svg]:size-4 sm:[&_svg]:size-5",
    rounded && "rounded-full p-2.5 bg-black/50 hover:bg-black/60",
    baseClassName,
    className,
  );

  return (
    <button type="button" data-slot={name} aria-label={label} aria-pressed={ariaPressed} title={label} className={mergeClassName} {...rest}>
      {children}
    </button>
  );
};

export default IconButton;
