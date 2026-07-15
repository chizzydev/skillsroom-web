"use client";
/* eslint-disable @next/next/no-img-element -- evidence media is private and served through access-audited routes */

import { useEffect, useRef, useState } from "react";

type EvidenceFileViewerClientProps = {
  fileName: string;
  title: string;
  url: string;
};

type FullscreenVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

const videoExtensions = new Set(["mp4", "mov", "webm"]);
const imageExtensions = new Set(["jpg", "jpeg", "png", "webp"]);

function extensionFrom(value: string) {
  return value.toLowerCase().match(/\.([a-z0-9]+)(?:$|[?#])/)?.[1] ?? "";
}

function mediaKind(fileName: string) {
  const extension = extensionFrom(fileName);
  if (videoExtensions.has(extension)) return "video";
  if (imageExtensions.has(extension)) return "image";
  return "file";
}

export function EvidenceFileViewerClient({ fileName, title, url }: EvidenceFileViewerClientProps) {
  const [hasStartedVideo, setHasStartedVideo] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<FullscreenVideoElement | null>(null);
  const kind = mediaKind(fileName);

  useEffect(() => {
    setHasStartedVideo(false);
    setLoadError(false);
  }, [url]);

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

  return (
    <main className="grid h-[100dvh] min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-ink text-white [padding-bottom:env(safe-area-inset-bottom)] [padding-left:env(safe-area-inset-left)] [padding-right:env(safe-area-inset-right)] [padding-top:env(safe-area-inset-top)]">
      <header className="z-10 flex min-h-14 items-center justify-between gap-2 border-b border-white/10 bg-ink/95 px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur sm:px-4">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-black">{title}</h1>
          <p className="mt-0.5 truncate font-mono text-[0.68rem] font-bold text-white/60">{fileName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {kind === "video" ? (
            <button className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 bg-white/10 px-3 text-xs font-black hover:bg-white/15" onClick={() => void openFullscreen()} type="button">
              Full screen
            </button>
          ) : null}
          <a className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 bg-white/10 px-3 text-xs font-black hover:bg-white/15" href={url} rel="noreferrer" target="_blank">
            Raw file
          </a>
        </div>
      </header>

      <section ref={viewerRef} className="grid min-h-0 place-items-center overflow-hidden bg-black">
        {kind === "image" ? (
          <img alt={title} className="block h-full max-h-full w-full max-w-full object-contain" src={url} />
        ) : kind === "video" ? (
          <div className="relative grid h-full w-full place-items-center overflow-hidden bg-black">
            <video
              ref={videoRef}
              className="block h-full max-h-full w-full max-w-full bg-black object-contain"
              controls={hasStartedVideo}
              onError={() => setLoadError(true)}
              onPlay={() => setHasStartedVideo(true)}
              playsInline
              preload="metadata"
              src={url}
            />
            {!hasStartedVideo && !loadError ? (
              <button
                aria-label={`Play ${title}`}
                className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-white/95 text-xl font-black text-ink shadow-[0_12px_35px_rgba(0,0,0,0.35)] transition hover:scale-105 hover:bg-white"
                onClick={() => void playVideo()}
                type="button"
              >
                <span className="ml-1 h-0 w-0 border-y-[0.55rem] border-l-[0.85rem] border-y-transparent border-l-ink" />
              </button>
            ) : null}
            {loadError ? (
              <div className="mx-4 max-w-sm rounded-lg border border-white/15 bg-white/10 p-4 text-center">
                <p className="text-sm font-black">Evidence could not play here.</p>
                <a className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-black text-ink" href={url} rel="noreferrer" target="_blank">
                  Open raw file
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <a className="rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm font-black hover:bg-white/15" href={url} rel="noreferrer" target="_blank">
            Open evidence file
          </a>
        )}
      </section>
    </main>
  );
}
