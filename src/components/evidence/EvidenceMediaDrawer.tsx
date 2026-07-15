"use client";
/* eslint-disable @next/next/no-img-element -- evidence media is private and served through access-audited routes */

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

type EvidenceMediaDrawerProps = {
  url: string | null | undefined;
  title: string;
  description?: string | null;
  className?: string;
  compact?: boolean;
  children?: ReactNode;
};

const evidencePathPattern = /\/api\/evidence-files\/([^/?#]+)/i;

function isImageUrl(url: string) {
  return /\.(?:jpg|jpeg|png|webp)(?:[?#].*)?$/i.test(url);
}

function isVideoUrl(url: string) {
  return /\.(?:mp4|webm|mov)(?:[?#].*)?$/i.test(url);
}

type FullscreenVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

function evidenceViewerUrl(url: string, title: string) {
  const match = evidencePathPattern.exec(url);
  if (!match?.[1]) return url;
  return `/evidence/files/${encodeURIComponent(decodeURIComponent(match[1]))}?${new URLSearchParams({ title }).toString()}`;
}

export function EvidenceMediaDrawer({ url, title, description, className, compact, children }: EvidenceMediaDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasStartedVideo, setHasStartedVideo] = useState(false);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<FullscreenVideoElement | null>(null);
  const openUrl = url ? evidenceViewerUrl(url, title) : "";
  const mediaKind = useMemo(() => {
    if (!url) return "none";
    if (isImageUrl(url)) return "image";
    if (isVideoUrl(url)) return "video";
    return "link";
  }, [url]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setHasStartedVideo(false);
  }, [isOpen, url]);

  async function openFullscreen() {
    const video = videoRef.current;
    if (video?.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
      return;
    }

    const target = video ?? viewerRef.current;
    if (target?.requestFullscreen) {
      await target.requestFullscreen().catch(() => undefined);
    }
  }

  async function playVideo() {
    const video = videoRef.current;
    if (!video) return;
    setHasStartedVideo(true);
    await video.play().catch(() => undefined);
  }

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
        <div className="fixed inset-0 z-50 grid h-[100dvh] w-screen overflow-hidden bg-ink" role="dialog" aria-modal="true" aria-label={title}>
          <div className="grid h-[100dvh] min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-ink [padding-bottom:env(safe-area-inset-bottom)] [padding-left:env(safe-area-inset-left)] [padding-right:env(safe-area-inset-right)] [padding-top:env(safe-area-inset-top)]">
            <div className="z-10 flex min-h-14 items-center justify-between gap-2 border-b border-white/10 bg-ink/95 px-3 py-2 text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur sm:px-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{title}</p>
                {description ? <p className="mt-0.5 line-clamp-1 text-xs font-bold text-white/65">{description}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {mediaKind === "video" ? (
                  <button className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 bg-white/10 px-3 text-xs font-black text-white hover:bg-white/15" onClick={() => void openFullscreen()} type="button">
                    Full screen
                  </button>
                ) : null}
                <a
                  className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 bg-white/10 px-3 text-xs font-black text-white hover:bg-white/15"
                  href={openUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open
                </a>
                <button className="grid h-10 w-10 place-items-center rounded-md border border-white/15 bg-white/10 text-sm font-black text-white hover:bg-white/15" onClick={() => setIsOpen(false)} type="button">
                  X
                </button>
              </div>
            </div>
            <div ref={viewerRef} className="grid min-h-0 place-items-center overflow-hidden bg-ink p-0">
              {mediaKind === "image" ? (
                <img alt={title} className="block h-full max-h-full w-full max-w-full object-contain" loading="eager" src={url} />
              ) : mediaKind === "video" ? (
                <div className="relative grid h-full w-full place-items-center overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    className="block h-full max-h-full w-full max-w-full bg-black object-contain"
                    controls={hasStartedVideo}
                    onPlay={() => setHasStartedVideo(true)}
                    playsInline
                    preload="metadata"
                    src={url}
                  />
                  {!hasStartedVideo ? (
                    <button
                      aria-label={`Play ${title}`}
                      className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-white/95 text-xl font-black text-ink shadow-[0_12px_35px_rgba(0,0,0,0.35)] transition hover:scale-105 hover:bg-white"
                      onClick={() => void playVideo()}
                      type="button"
                    >
                      <span className="ml-1 h-0 w-0 border-y-[0.55rem] border-l-[0.85rem] border-y-transparent border-l-ink" />
                    </button>
                  ) : null}
                </div>
              ) : (
                <a className="rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/15" href={url} rel="noreferrer" target="_blank">
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
