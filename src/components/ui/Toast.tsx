import type { ReactNode } from "react";

type ToastProps = {
  title: string;
  description?: string;
  tone?: "success" | "warning" | "danger" | "neutral";
  children?: ReactNode;
};

const toneClass: Record<NonNullable<ToastProps["tone"]>, string> = {
  success: "border-green-200 bg-successSoft",
  warning: "border-orange-200 bg-warningSoft",
  danger: "border-red-200 bg-dangerSoft",
  neutral: "border-line bg-white"
};

export function Toast({ title, description, tone = "neutral", children }: ToastProps) {
  return (
    <div className={["rounded-md border p-4 shadow-tight", toneClass[tone]].join(" ")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-ink">{title}</p>
          {description ? <p className="mt-1 text-sm leading-6 text-muted">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
