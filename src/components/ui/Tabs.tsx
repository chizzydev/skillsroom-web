type TabItem = {
  label: string;
  active?: boolean;
  href?: string;
};

export function Tabs({ items }: { items: TabItem[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-1 rounded-md border border-line bg-surfaceHigh p-1 sm:min-w-0">
        {items.map((item) => {
          const className = [
            "inline-flex min-h-10 shrink-0 items-center justify-center rounded-sm px-4 text-sm font-black transition",
            item.active ? "bg-white text-ink shadow-tight" : "text-muted hover:bg-white/70 hover:text-ink"
          ].join(" ");

          return item.href ? (
            <a className={className} href={item.href} key={item.label}>
              {item.label}
            </a>
          ) : (
            <button className={className} key={item.label} type="button">
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
