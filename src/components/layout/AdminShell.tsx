import Link from "next/link";
import { AccountMenu } from "./AccountMenu";
import { getCurrentUser } from "@/lib/auth-bridge";

type AdminShellProps = {
  active: "overview" | "funding" | "results" | "settlements" | "tournaments" | "matches" | "players" | "disputes" | "risk";
  children: React.ReactNode;
};

const nav = [
  { key: "overview", label: "Overview", href: "/admin" },
  { key: "funding", label: "Funding", href: "/admin/funding" },
  { key: "results", label: "Results", href: "/admin/results" },
  { key: "settlements", label: "Settlements", href: "/admin/settlements" },
  { key: "tournaments", label: "Tournaments", href: "/admin/tournaments" },
  { key: "players", label: "Players", href: "/admin/players" },
  { key: "risk", label: "Risk", href: "/admin/risk" }
] as const;

export async function AdminShell({ active, children }: AdminShellProps) {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen bg-bg lg:grid lg:grid-cols-[18rem_1fr]">
      <aside className="border-b border-line bg-navy-900 text-white shadow-inset lg:sticky lg:top-0 lg:min-h-screen lg:border-b-0 lg:border-r lg:border-white/10">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4 lg:block lg:p-5">
          <Link className="flex min-w-0 items-center gap-3 text-lg font-black" href="/admin">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-action text-sm text-navy-950 shadow-action">SR</span>
            <span className="truncate">Skillsroom Ops</span>
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
        <nav className="flex gap-1 overflow-x-auto p-3 lg:grid lg:overflow-visible">
          {nav.map((item) => (
            <Link
              className={[
                "whitespace-nowrap rounded-md px-3 py-2 text-sm font-black transition",
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
            <p className="mt-2 truncate text-sm font-black text-white">{user?.email ?? "Operator"}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{user?.role ?? "support"}</p>
          </div>
        </div>
      </aside>
      <section className="min-w-0">
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-line bg-white/95 px-6 backdrop-blur lg:flex">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-muted">Operations</p>
            <p className="text-sm font-bold text-ink">Funding, evidence, settlement, and risk queues</p>
          </div>
          <AccountMenu user={user} />
        </header>
        <div className="p-page lg:p-8">{children}</div>
      </section>
    </main>
  );
}
