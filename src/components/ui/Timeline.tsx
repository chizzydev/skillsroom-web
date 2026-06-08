import { Badge } from "./Badge";

type TimelineItem = {
  label: string;
  detail: string;
  status?: "done" | "current" | "pending" | "risk";
};

const markerClass: Record<NonNullable<TimelineItem["status"]>, string> = {
  done: "bg-success",
  current: "bg-cyan",
  pending: "bg-slate-300",
  risk: "bg-danger"
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="grid gap-0">
      {items.map((item, index) => (
        <div className="grid grid-cols-[18px_1fr] gap-3" key={`${item.label}-${index}`}>
          <div className="grid justify-center">
            <span className={["mt-1 h-3 w-3 rounded-full", markerClass[item.status ?? "pending"]].join(" ")} />
            {index < items.length - 1 ? <span className="mx-auto min-h-8 w-px bg-line" /> : null}
          </div>
          <div className="pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-sm font-black text-ink">{item.label}</strong>
              {item.status === "current" ? <Badge tone="cyan">Now</Badge> : null}
              {item.status === "risk" ? <Badge tone="danger">Risk</Badge> : null}
            </div>
            <p className="mt-1 text-sm leading-6 text-muted">{item.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
