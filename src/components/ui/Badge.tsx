export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "cyan";

type BadgeProps = {
  children: React.ReactNode;
  tone?: BadgeTone;
};

const toneClass: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "border-line bg-surfaceHigh text-muted",
  success: "border-green-200 bg-successSoft text-success",
  warning: "border-orange-200 bg-warningSoft text-warning",
  danger: "border-red-200 bg-dangerSoft text-danger",
  cyan: "border-sky-200 bg-cyanSoft text-cyan"
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex w-fit max-w-full items-center rounded-full border px-2.5 py-1 font-mono text-[0.68rem] font-black uppercase leading-none tracking-[0.08em]",
        toneClass[tone]
      ].join(" ")}
    >
      {children}
    </span>
  );
}
