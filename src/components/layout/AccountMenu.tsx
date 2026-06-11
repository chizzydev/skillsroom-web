"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { CurrentUser } from "@/lib/auth-bridge";

type AccountMenuProps = {
  user: CurrentUser | null;
  align?: "left" | "right";
  compact?: boolean;
};

function initialsFor(user: CurrentUser | null) {
  const source = user?.email ?? "Skillsroom";
  return source
    .split("@")[0]
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AccountMenu({ user, align = "right", compact = false }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!user) {
    return (
      <Link
        className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh"
        href="/sign-in"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        className={[
          "flex cursor-pointer list-none items-center gap-2 rounded-md border border-line bg-white p-1.5 pr-3 text-sm font-black text-ink shadow-tight transition hover:bg-surfaceHigh",
          compact ? "pr-1.5" : ""
        ].join(" ")}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-action text-xs font-black text-navy-950">
          {initialsFor(user)}
        </span>
        {!compact ? (
          <span className="hidden max-w-[9rem] truncate md:inline">{user.email ?? user.role}</span>
        ) : null}
        <span className={["text-xs text-muted transition", open ? "rotate-180" : ""].join(" ")}>v</span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
        className={[
          "absolute top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-white shadow-panel",
          align === "right" ? "right-0" : "left-0"
        ].join(" ")}
      >
        <div className="border-b border-line p-4">
          <p className="truncate text-sm font-black text-ink">{user.email ?? "Skillsroom account"}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">{user.role}</p>
        </div>
        <Link className="block px-4 py-3 text-sm font-bold text-muted hover:bg-surfaceHigh hover:text-ink" href="/profile" onClick={() => setOpen(false)} role="menuitem">
          Profile
        </Link>
        <Link className="block px-4 py-3 text-sm font-bold text-muted hover:bg-surfaceHigh hover:text-ink" href="/notifications" onClick={() => setOpen(false)} role="menuitem">
          Notifications
        </Link>
        <Link className="block px-4 py-3 text-sm font-bold text-muted hover:bg-surfaceHigh hover:text-ink" href="/community" onClick={() => setOpen(false)} role="menuitem">
          Community pulse
        </Link>
        {["support", "moderator", "admin", "owner"].includes(user.role) ? (
          <Link className="block px-4 py-3 text-sm font-bold text-muted hover:bg-surfaceHigh hover:text-ink" href="/admin" onClick={() => setOpen(false)} role="menuitem">
            Admin workspace
          </Link>
        ) : null}
        <form action="/api/auth/logout" className="border-t border-line" method="post">
          <button className="w-full px-4 py-3 text-left text-sm font-bold text-muted hover:bg-surfaceHigh hover:text-ink" role="menuitem" type="submit">
            Sign out
          </button>
        </form>
        </div>
      ) : null}
    </div>
  );
}
