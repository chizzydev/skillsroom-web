type TabItem = {
  label: string;
  active?: boolean;
  href?: string;
};

export function Tabs({ items }: { items: TabItem[] }) {
  return (
    <div className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="grid min-w-full grid-cols-2 gap-1 rounded-md border border-line bg-surfaceHigh p-1 min-[360px]:grid-cols-3 min-[520px]:grid-cols-4 lg:inline-flex lg:min-w-max">
        {items.map((item) => {
          const className = [
            "inline-flex min-h-10 min-w-0 items-center justify-center rounded-sm px-2 text-center text-xs font-black leading-tight transition sm:px-3 sm:text-sm lg:shrink-0",
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
