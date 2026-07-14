import type { HTMLAttributes, ReactNode } from "react";

type PanelProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
};

export function Panel({ children, className = "", ...props }: PanelProps) {
  return (
    <section
      className={[
        "motion-card motion-premium-panel min-w-0 overflow-hidden rounded-[1.35rem] border border-line bg-surface shadow-[0_18px_50px_rgba(3,10,20,0.08)]",
        className
      ].join(" ")}
      {...props}
    >
      {children}
    </section>
  );
}

type PanelHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function PanelHeader({ eyebrow, title, description, action }: PanelHeaderProps) {
  return (
    <header className="flex min-w-0 flex-col gap-4 border-b border-line bg-white px-4 py-4 sm:px-5 sm:py-5 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">{eyebrow}</p>
        ) : null}
        <h2 className="mt-1 text-lg font-black leading-tight text-ink sm:text-[1.15rem]">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex w-full max-w-full shrink-0 flex-wrap gap-2 md:w-auto">{action}</div> : null}
    </header>
  );
}
