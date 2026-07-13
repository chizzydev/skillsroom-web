"use client";
/* eslint-disable @next/next/no-img-element -- evidence media is private and served through access-audited routes */

import { type ReactNode, useMemo, useState } from "react";

type EvidenceMediaDrawerProps = {
  url: string | null | undefined;
  title: string;
  description?: string | null;
  className?: string;
  compact?: boolean;
  children?: ReactNode;
};

function isImageUrl(url: string) {
  return /\.(?:jpg|jpeg|png|webp)(?:[?#].*)?$/i.test(url);
}

function isVideoUrl(url: string) {
  return /\.(?:mp4|webm|mov)(?:[?#].*)?$/i.test(url);
}

export function EvidenceMediaDrawer({ url, title, description, className, compact, children }: EvidenceMediaDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const mediaKind = useMemo(() => {
    if (!url) return "none";
    if (isImageUrl(url)) return "image";
    if (isVideoUrl(url)) return "video";
    return "link";
  }, [url]);

  if (!url) {
    return (
      <div className={["rounded-md border border-dashed border-line bg-surfaceWarm p-3 text-sm font-bold text-muted", className].filter(Boolean).join(" ")}>
        Evidence file unavailable.
      </div>
    );
  }

  return (
    <>
      <button
        className={[
          compact
            ? "inline-flex font-black text-cyan hover:text-action"
            : "w-full rounded-md border border-line bg-white p-3 text-left text-sm font-bold text-ink hover:border-lineStrong hover:bg-surfaceHigh",
          className
        ].filter(Boolean).join(" ")}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {children ?? (
          <>
            <span className={compact ? "" : "block [overflow-wrap:anywhere]"}>{title}</span>
            {!compact && description ? <span className="mt-1 block text-xs leading-5 text-muted">{description}</span> : null}
          </>
        )}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 grid bg-ink/70 p-4 backdrop-blur-sm md:p-8" role="dialog" aria-modal="true" aria-label={title}>
          <div className="mx-auto grid h-full w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg bg-white shadow-panel">
            <div className="flex items-start justify-between gap-4 border-b border-line p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-ink">{title}</p>
                {description ? <p className="mt-1 line-clamp-2 text-xs font-bold text-muted">{description}</p> : null}
              </div>
              <button className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-surfaceHigh text-sm font-black text-ink" onClick={() => setIsOpen(false)} type="button">
                X
              </button>
            </div>
            <div className="grid min-h-0 place-items-center bg-surface p-4">
              {mediaKind === "image" ? (
                <img alt={title} className="max-h-full max-w-full object-contain" loading="eager" src={url} />
              ) : mediaKind === "video" ? (
                <video className="max-h-full max-w-full" controls preload="metadata" src={url} />
              ) : (
                <a className="rounded-md bg-ink px-4 py-3 text-sm font-black text-white" href={url} rel="noreferrer" target="_blank">
                  Open evidence
                </a>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
