import { Button } from "./Button";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  tone?: "neutral" | "cyan" | "warning" | "danger";
};

const toneClass: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  neutral: "border-line bg-surfaceWarm",
  cyan: "border-sky-200 bg-cyanSoft",
  warning: "border-orange-200 bg-warningSoft",
  danger: "border-red-200 bg-dangerSoft"
};

export function EmptyState({ title, description, actionLabel, tone = "neutral" }: EmptyStateProps) {
  return (
    <div className={["grid place-items-center rounded-md border border-dashed p-8 text-center", toneClass[tone]].join(" ")}>
      <div className="max-w-md">
        <h3 className="text-lg font-black text-ink">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        {actionLabel ? (
          <Button className="mt-4" size="sm" type="button" variant="secondary">
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
