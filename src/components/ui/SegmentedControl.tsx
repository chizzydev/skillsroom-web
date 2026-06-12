"use client";

import Link from "next/link";

type Segment = {
  label: string;
  active?: boolean;
  href?: string;
  value?: string;
};

type SegmentedControlProps = {
  segments: Segment[];
  onSelect?: (value: string) => void;
  pendingValue?: string;
};

export function SegmentedControl({ segments, onSelect, pendingValue }: SegmentedControlProps) {
  return (
    <div className="grid w-full auto-cols-max grid-flow-col overflow-x-auto rounded-md border border-line bg-surfaceHigh p-1 sm:inline-grid sm:w-auto">
      {segments.map((segment) => (
        segment.href && !onSelect ? (
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
            onClick={() => {
              if (!onSelect) return;
              onSelect(segment.value ?? segment.label);
            }}
            type="button"
          >
            {pendingValue && pendingValue === (segment.value ?? segment.label) ? "Loading..." : segment.label}
          </button>
        )
      ))}
    </div>
  );
}
