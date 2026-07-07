"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentProps, type MouseEvent } from "react";

type PendingLinkProps = ComponentProps<typeof Link> & {
  pendingLabel?: string;
};

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function PendingLink({
  children,
  className = "",
  href,
  onClick,
  pendingLabel = "Opening...",
  ...props
}: PendingLinkProps) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const hrefString =
    typeof href === "string"
      ? href
      : `${href.pathname ?? ""}${href.search ?? ""}${href.hash ?? ""}`;
  const samePageHash = hrefString.startsWith("#") || hrefString === pathname;

  useEffect(() => {
    if (!pending) return;

    const timeout = window.setTimeout(() => {
      setPending(false);
    }, 10_000);

    return () => window.clearTimeout(timeout);
  }, [pending]);

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  return (
    <Link
      aria-busy={pending}
      className={[
        "motion-tap",
        className,
        pending ? "pointer-events-none cursor-wait opacity-70" : ""
      ].join(" ")}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || isModifiedClick(event) || samePageHash) return;
        setPending(true);
      }}
      {...props}
    >
      {pending ? pendingLabel : children}
    </Link>
  );
}
