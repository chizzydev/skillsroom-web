import Link from "next/link";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { GlobalActionFeedback } from "@/components/ui/GlobalActionFeedback";
import { getCurrentUser } from "@/lib/auth-bridge";

type AppShellProps = {
  active: "home" | "lobby" | "matches" | "tournaments" | "community" | "notifications" | "wallet" | "profile";
  children: React.ReactNode;
};

const nav = [
  { key: "home", label: "Home", short: "Home", href: "/" },
  { key: "lobby", label: "Chat", short: "Chat", href: "/chat" },
  { key: "matches", label: "Rooms", short: "Rooms", href: "/matches" },
  { key: "tournaments", label: "Tournaments", short: "Tourney", href: "/tournaments" },
  { key: "wallet", label: "Wallet", short: "Wallet", href: "/wallet" },
  { key: "profile", label: "Profile", short: "Profile", href: "/profile" }
] as const;

const mobileNav = nav;

const footerLinks = [
  { label: "Policies", href: "/policies" },
  { label: "Rules", href: "/rules" },
  { label: "Prizes", href: "/prizes" },
  { label: "Disputes", href: "/disputes" },
  { label: "Trust", href: "/trust" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Support", href: "/support" }
] as const;

export async function AppShell({ active, children }: AppShellProps) {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-page">
          <Link className="flex min-w-0 items-center gap-3 text-lg font-black text-ink" href="/">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-navy-900 text-sm text-action shadow-tight">SR</span>
            <span className="hidden truncate min-[430px]:inline">Skillsroom</span>
          </Link>
          <nav className="ml-3 hidden flex-1 items-center justify-center gap-1 md:flex">
            {nav.map((item) => (
              <Link
                className={[
                  "whitespace-nowrap rounded-md px-3 py-2 text-sm font-black transition",
                  item.key === active ? "bg-surfaceHigh text-ink shadow-tight" : "text-muted hover:bg-surfaceHigh hover:text-ink"
                ].join(" ")}
                href={item.href}
                key={item.key}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
              <Link className="hidden min-h-control items-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover sm:inline-flex" href="/matches/new">
                Create room
              </Link>
            {user ? (
              <>
                <Link
                  aria-label="Open notifications"
                  className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink shadow-tight transition hover:bg-surfaceHigh"
                  href="/notifications"
                >
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                  </svg>
                </Link>
                <AccountMenu compact user={user} />
              </>
            ) : (
              <Link className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href="/sign-in">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <GlobalActionFeedback />
      <div className="mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden px-page py-4 sm:py-5 md:py-7">{children}</div>
      <footer className="border-t border-white/10 bg-navy-900">
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-page pt-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:py-6">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white/10 text-xs font-black text-action">SR</span>
              <strong className="text-sm font-black text-white">Skillsroom</strong>
            </div>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-300">
              Private competitive rooms with clear rules, payment checks, match proof, and support when something goes wrong.
            </p>
          </div>
          <nav className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 text-xs font-black text-slate-300 sm:flex sm:flex-wrap">
            {footerLinks.map((item) => (
              <Link className="hover:text-white" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.65rem)] pt-2 shadow-[0_-18px_40px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-6 gap-1">
          {mobileNav.map((item) => (
            <Link
              className={[
                "grid min-h-[3.15rem] min-w-0 place-items-center rounded-xl px-1 text-center text-[0.62rem] font-black leading-tight sm:text-[0.68rem]",
                item.key === active ? "bg-cyanSoft text-ink shadow-tight" : "text-muted"
              ].join(" ")}
              href={item.href}
              key={item.key}
            >
              <span className="truncate">{item.short}</span>
            </Link>
          ))}
        </div>
      </nav>
    </main>
  );
}
