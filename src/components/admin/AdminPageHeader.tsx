import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

type AdminPageHeaderProps = {
  eyebrow: string;
  tone?: BadgeTone;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function AdminPageHeader({ eyebrow, tone = "cyan", title, description, actions }: AdminPageHeaderProps) {
  return (
    <section className="motion-admin-surface motion-state-card rounded-lg border border-line bg-white p-4 shadow-tight md:p-5">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="min-w-0">
          <Badge tone={tone}>{eyebrow}</Badge>
          <h1 className="mt-3 text-2xl font-black leading-tight text-ink md:text-3xl">{title}</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted md:text-base">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}
