"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type TransientStatusBannerProps = {
  message: string;
  tone?: "success" | "danger";
  clearKeys?: string[];
  durationMs?: number;
};

export function TransientStatusBanner({
  message,
  tone = "danger",
  clearKeys = ["error", "success"],
  durationMs = 10000
}: TransientStatusBannerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const bannerRef = useRef<HTMLDivElement | null>(null);

  const className = useMemo(
    () => [
      "rounded-md border p-4 text-sm font-bold",
      tone === "success" ? "border-success bg-emerald-50 text-success" : "border-danger bg-red-50 text-danger"
    ].join(" "),
    [tone]
  );

  useEffect(() => {
    if (tone === "danger") {
      const focusTimer = window.setTimeout(() => {
        bannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        bannerRef.current?.focus({ preventScroll: true });
      }, 120);

      return () => window.clearTimeout(focusTimer);
    }
  }, [tone, message]);

  useEffect(() => {
    if (clearKeys.length === 0) return;

    const params = new URLSearchParams(searchParams.toString());
    let changed = false;
    for (const key of clearKeys) {
      if (params.has(key)) {
        params.delete(key);
        changed = true;
      }
    }
    if (!changed) return;
    const next = params.toString();
    const timer = setTimeout(() => {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }, durationMs);

    return () => clearTimeout(timer);
  }, [clearKeys, durationMs, pathname, router, searchParams]);

  return (
    <div
      className={className}
      data-action-feedback-inline={tone}
      ref={bannerRef}
      role={tone === "danger" ? "alert" : "status"}
      tabIndex={tone === "danger" ? -1 : undefined}
    >
      {message}
    </div>
  );
}
