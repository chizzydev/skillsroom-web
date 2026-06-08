import Link from "next/link";
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
    <details className="group relative">
      <summary
        className={[
          "flex cursor-pointer list-none items-center gap-2 rounded-md border border-line bg-white p-1.5 pr-3 text-sm font-black text-ink shadow-tight transition hover:bg-surfaceHigh",
          compact ? "pr-1.5" : ""
        ].join(" ")}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-action text-xs font-black text-navy-950">
          {initialsFor(user)}
        </span>
        {!compact ? (
          <span className="hidden max-w-[9rem] truncate md:inline">{user.email ?? user.role}</span>
        ) : null}
        <span className="text-xs text-muted group-open:rotate-180">v</span>
      </summary>
      <div
        className={[
          "absolute top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-white shadow-panel",
          align === "right" ? "right-0" : "left-0"
        ].join(" ")}
      >
        <div className="border-b border-line p-4">
          <p className="truncate text-sm font-black text-ink">{user.email ?? "Skillsroom account"}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted">{user.role}</p>
        </div>
        <Link className="block px-4 py-3 text-sm font-bold text-muted hover:bg-surfaceHigh hover:text-ink" href="/profile">
          Profile
        </Link>
        <Link className="block px-4 py-3 text-sm font-bold text-muted hover:bg-surfaceHigh hover:text-ink" href="/notifications">
          Notifications
        </Link>
        <Link className="block px-4 py-3 text-sm font-bold text-muted hover:bg-surfaceHigh hover:text-ink" href="/community">
          Community pulse
        </Link>
        {["support", "moderator", "admin", "owner"].includes(user.role) ? (
          <Link className="block px-4 py-3 text-sm font-bold text-muted hover:bg-surfaceHigh hover:text-ink" href="/admin">
            Admin console
          </Link>
        ) : null}
        <form action="/api/auth/logout" className="border-t border-line" method="post">
          <button className="w-full px-4 py-3 text-left text-sm font-bold text-muted hover:bg-surfaceHigh hover:text-ink" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
