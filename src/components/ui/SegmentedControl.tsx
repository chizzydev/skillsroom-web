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
    <div className="flex w-full min-w-0 flex-wrap gap-1 overflow-hidden rounded-md border border-line bg-surfaceHigh p-1 sm:inline-flex sm:w-auto sm:flex-nowrap sm:overflow-x-auto">
      {segments.map((segment) => (
        segment.href && !onSelect ? (
          <Link
            className={[
              "inline-flex min-h-9 min-w-0 flex-1 items-center justify-center rounded-sm px-3 text-center text-xs font-black leading-tight transition sm:flex-none sm:whitespace-nowrap",
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
              "min-h-9 min-w-0 flex-1 rounded-sm px-3 text-center text-xs font-black leading-tight transition sm:flex-none sm:whitespace-nowrap",
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
