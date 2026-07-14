import Link from "next/link";
import { AccountMenu } from "./AccountMenu";
import { GlobalActionFeedback } from "@/components/ui/GlobalActionFeedback";
import { canUseAdminSection, getCurrentUser, type AdminSection } from "@/lib/auth-bridge";

type AdminShellProps = {
  active: AdminSection | "matches" | "disputes";
  children: React.ReactNode;
};

const nav: Array<{ key: AdminSection; label: string; href: string }> = [
  { key: "overview", label: "Overview", href: "/admin" },
  { key: "funding", label: "Funding", href: "/admin/funding" },
  { key: "wallet", label: "Wallet", href: "/admin/wallet" },
  { key: "results", label: "Results", href: "/admin/results" },
  { key: "settlements", label: "Payments", href: "/admin/settlements" },
  { key: "tournaments", label: "Tournaments", href: "/admin/tournaments" },
  { key: "players", label: "Players", href: "/admin/players" },
  { key: "observability", label: "Observability", href: "/admin/observability" },
  { key: "team", label: "Team roles", href: "/admin/team" },
  { key: "risk", label: "Safety", href: "/admin/risk" }
] as const;

function roleLabel(role: string | undefined) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "moderator") return "Community Manager";
  if (role === "support") return "Support";
  return "Player";
}

function shellTitle(role: string | undefined) {
  if (role === "moderator") return "Skillsroom Community";
  if (role === "support") return "Skillsroom Support";
  return "Skillsroom Admin";
}

function shellSubtitle(role: string | undefined) {
  if (role === "moderator") return "Match results, player checks, tournaments, and community safety";
  if (role === "support") return "Player records, support context, and safety visibility";
  if (role === "admin") return "Funding, wallet, payouts, tournaments, and result support";
  return "Payments, results, players, tournaments, and team controls";
}

export async function AdminShell({ active, children }: AdminShellProps) {
  const user = await getCurrentUser();
  const navItems = nav.filter((item) => canUseAdminSection(user, item.key));

  return (
    <main className="motion-page-enter min-h-screen bg-bg lg:grid lg:grid-cols-[18rem_1fr]">
      <aside className="border-b border-line bg-navy-900 text-white shadow-inset lg:sticky lg:top-0 lg:min-h-screen lg:border-b-0 lg:border-r lg:border-white/10">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4 lg:block lg:p-5">
          <Link className="flex min-w-0 items-center gap-3 text-lg font-black" href="/admin">
            <span className="motion-glow grid h-10 w-10 shrink-0 place-items-center rounded-md bg-action text-sm text-navy-950 shadow-action">SR</span>
            <span className="truncate">{shellTitle(user?.role)}</span>
          </Link>
          <div className="flex items-center gap-2 lg:mt-4">
            <Link className="inline-flex min-h-9 items-center rounded-md border border-white/10 px-3 text-xs font-black text-slate-200 hover:bg-white/10" href="/">
              Player app
            </Link>
            <span className="lg:hidden">
              <AccountMenu compact user={user} />
            </span>
          </div>
        </div>
        <nav className="grid grid-cols-3 gap-1 p-3 min-[520px]:grid-cols-5 lg:grid-cols-1">
          {navItems.map((item) => (
            <Link
              className={[
                "motion-tap min-h-10 rounded-md px-2 py-2 text-center text-xs font-black leading-tight transition sm:px-3 sm:text-sm lg:text-left",
                item.key === active ? "bg-white text-navy-900 shadow-tight" : "text-slate-300 hover:bg-white/10"
              ].join(" ")}
              href={item.href}
              key={item.key}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden p-3 lg:block">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-slate-300">Signed in</p>
            <p className="mt-2 truncate text-sm font-black text-white">{user?.email ?? "Team member"}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{roleLabel(user?.role)}</p>
          </div>
        </div>
      </aside>
      <section className="min-w-0">
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-line bg-white/95 px-6 backdrop-blur lg:flex">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-muted">{roleLabel(user?.role)}</p>
            <p className="text-sm font-bold text-ink">{shellSubtitle(user?.role)}</p>
          </div>
          <AccountMenu user={user} />
        </header>
        <GlobalActionFeedback />
        <div className="p-page lg:p-8">{children}</div>
      </section>
    </main>
  );
}
