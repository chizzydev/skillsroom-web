import type { ReactNode } from "react";

type MobileSheetProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function MobileSheet({ title, description, children }: MobileSheetProps) {
  return (
    <section className="rounded-t-xl border border-line bg-white p-4 shadow-lift md:rounded-lg md:p-5">
      <header className="border-b border-line pb-4">
        <h2 className="text-lg font-black text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-muted">{description}</p> : null}
      </header>
      <div className="pt-4">{children}</div>
    </section>
  );
}
