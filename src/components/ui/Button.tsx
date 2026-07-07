import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
};

export function Button({ className = "", variant = "primary", size = "md", fullWidth = false, ...props }: ButtonProps) {
  const variantClass = {
    primary: "bg-action text-navy-950 shadow-action hover:bg-actionHover active:translate-y-px",
    secondary: "border border-line bg-white text-ink shadow-tight hover:border-lineStrong hover:bg-surfaceHigh active:translate-y-px",
    ghost: "bg-transparent text-muted hover:bg-surfaceHigh hover:text-ink",
    danger: "border border-danger bg-white text-danger shadow-tight hover:bg-red-50 active:translate-y-px"
  }[variant];
  const sizeClass = {
    sm: "min-h-9 px-3 text-xs",
    md: "min-h-control px-4 text-sm",
    lg: "min-h-12 px-5 text-base"
  }[size];

  return (
    <button
      className={[
        "motion-tap motion-admin-action inline-flex items-center justify-center gap-2 rounded-md font-black transition disabled:cursor-not-allowed disabled:opacity-55",
        sizeClass,
        variantClass,
        fullWidth ? "w-full" : "",
        className
      ].join(" ")}
      {...props}
    />
  );
}
