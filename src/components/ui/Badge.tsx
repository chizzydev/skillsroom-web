export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "cyan";

type BadgeProps = {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
  glow?: boolean;
  live?: boolean;
};

const toneClass: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "border-line bg-surfaceHigh text-muted",
  success: "border-green-200 bg-successSoft text-success",
  warning: "border-orange-200 bg-warningSoft text-warning",
  danger: "border-red-200 bg-dangerSoft text-danger",
  cyan: "border-sky-200 bg-cyanSoft text-cyan"
};

export function Badge({ children, tone = "neutral", className = "", glow = false, live = false }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex w-fit max-w-full items-center rounded-full border px-2.5 py-1.5 font-mono text-[0.64rem] font-black uppercase leading-none tracking-[0.1em] sm:text-[0.68rem]",
        toneClass[tone],
        glow ? "motion-glow" : "",
        live ? "motion-live" : "",
        className
      ].join(" ")}
    >
      {children}
    </span>
  );
}
