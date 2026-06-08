import Link from "next/link";

type Segment = {
  label: string;
  active?: boolean;
  href?: string;
};

export function SegmentedControl({ segments }: { segments: Segment[] }) {
  return (
    <div className="grid w-full auto-cols-max grid-flow-col overflow-x-auto rounded-md border border-line bg-surfaceHigh p-1 sm:inline-grid sm:w-auto">
      {segments.map((segment) => (
        segment.href ? (
          <Link
            className={[
              "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-sm px-3 text-xs font-black transition",
              segment.active ? "bg-white text-ink shadow-tight" : "text-muted hover:text-ink"
            ].join(" ")}
            href={segment.href}
            key={segment.label}
          >
            {segment.label}
          </Link>
        ) : (
          <button
            className={[
              "min-h-9 whitespace-nowrap rounded-sm px-3 text-xs font-black transition",
              segment.active ? "bg-white text-ink shadow-tight" : "text-muted hover:text-ink"
            ].join(" ")}
            key={segment.label}
            type="button"
          >
            {segment.label}
          </button>
        )
      ))}
    </div>
  );
}
