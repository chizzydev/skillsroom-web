import type { HTMLAttributes, ReactNode } from "react";

type PanelProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
};

export function Panel({ children, className = "", ...props }: PanelProps) {
  return (
    <section className={["min-w-0 overflow-hidden rounded-lg border border-line bg-surface shadow-tight", className].join(" ")} {...props}>
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
    <header className="flex min-w-0 flex-col gap-4 border-b border-line bg-white p-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">{eyebrow}</p>
        ) : null}
        <h2 className="mt-1 text-lg font-black leading-tight text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex max-w-full shrink-0 flex-wrap gap-2 overflow-x-auto">{action}</div> : null}
    </header>
  );
}
