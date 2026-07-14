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
    <div className="grid w-full min-w-0 grid-cols-2 gap-1 overflow-hidden rounded-md border border-line bg-surfaceHigh p-1 min-[360px]:grid-cols-3 min-[520px]:grid-cols-4 lg:inline-flex lg:w-auto lg:flex-nowrap">
      {segments.map((segment) => (
        segment.href && !onSelect ? (
          <Link
            className={[
              "inline-flex min-h-9 min-w-0 items-center justify-center rounded-sm px-2 text-center text-xs font-black leading-tight transition sm:px-3 lg:flex-none lg:whitespace-nowrap",
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
              "min-h-9 min-w-0 rounded-sm px-2 text-center text-xs font-black leading-tight transition sm:px-3 lg:flex-none lg:whitespace-nowrap",
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
