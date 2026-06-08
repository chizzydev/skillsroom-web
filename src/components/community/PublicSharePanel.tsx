"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";

type PublicSharePanelProps = {
  title: string;
  summary: string;
  url: string;
  eyebrow?: string;
  panelTitle?: string;
  panelDescription?: string;
};

function trimSummary(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function PublicSharePanel({
  title,
  summary,
  url,
  eyebrow = "Share",
  panelTitle = "Share this public page",
  panelDescription = "Built for mobile sharing, native share sheets, and clean social previews."
}: PublicSharePanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const shareText = useMemo(() => `${title}\n${trimSummary(summary)}\n${url}`, [summary, title, url]);
  const whatsappHref = useMemo(() => `https://wa.me/?text=${encodeURIComponent(shareText)}`, [shareText]);
  const twitterHref = useMemo(
    () => `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title} - ${trimSummary(summary)}`)}&url=${encodeURIComponent(url)}`,
    [summary, title, url]
  );

  function showMessage(next: string) {
    startTransition(() => {
      setMessage(next);
      window.setTimeout(() => setMessage(null), 2400);
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      showMessage("Public link copied.");
    } catch {
      showMessage("Unable to copy the public link on this device.");
    }
  }

  async function handleNativeShare() {
    if (!navigator.share) {
      window.open(whatsappHref, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      await navigator.share({ title, text: trimSummary(summary), url });
    } catch {}
  }

  return (
    <div className="grid gap-4 p-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">{eyebrow}</p>
        <h2 className="mt-2 text-lg font-black text-ink">{panelTitle}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{panelDescription}</p>
      </div>

      {message ? <Toast title={message} tone="success" /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Button onClick={handleNativeShare} type="button">
          Share
        </Button>
        <Button onClick={handleCopy} type="button" variant="secondary">
          Copy link
        </Button>
        <a
          className="inline-flex min-h-control items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh"
          href={whatsappHref}
          rel="noreferrer"
          target="_blank"
        >
          WhatsApp
        </a>
        <a
          className="inline-flex min-h-control items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink shadow-tight hover:bg-surfaceHigh"
          href={twitterHref}
          rel="noreferrer"
          target="_blank"
        >
          X / Twitter
        </a>
      </div>

      <div className="rounded-md border border-line bg-white p-4">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Public link</p>
        <p className="mt-2 break-all font-mono text-xs text-ink">{url}</p>
      </div>

      <p className="text-xs leading-5 text-muted">
        {isPending ? "Updating share state..." : "Preview cards use the linked page metadata, so shared links stay readable in chat apps."}
      </p>
    </div>
  );
}
