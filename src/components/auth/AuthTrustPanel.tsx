import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

type AuthTrustPanelProps = {
  title: string;
  summary: string;
  ctaHref: string;
  ctaLabel: string;
};

const trustPoints = [
  "Skillsroom is a competitive gaming platform for structured match rooms and tournaments.",
  "Entry proof, evidence review, disputes, and settlements stay inside one auditable workflow.",
  "Policies, support, and public community pages remain visible before sign-in so players can inspect the platform first."
] as const;

const quickLinks = [
  { href: "/community", label: "Community" },
  { href: "/policies", label: "Policies" },
  { href: "/rules", label: "Competition rules" },
  { href: "/support", label: "Support" }
] as const;

export function AuthTrustPanel({ title, summary, ctaHref, ctaLabel }: AuthTrustPanelProps) {
  return (
    <section className="rounded-lg border border-white/10 bg-navy-900 p-6 text-white shadow-panel">
      <Badge tone="cyan">Skill-based competition</Badge>
      <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">{summary}</p>

      <div className="mt-6 grid gap-3">
        {trustPoints.map((item) => (
          <div className="rounded-md border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-200" key={item}>
            {item}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {quickLinks.map((item) => (
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/10 bg-white/10 px-4 text-sm font-black text-white hover:bg-white/15"
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-cyan/25 bg-white/5 p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">Before you continue</p>
        <p className="mt-2 text-sm leading-6 text-slate-200">
          Review the public product, competition rules, and trust policies first if you are new here.
        </p>
        <Link
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover"
          href={ctaHref}
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
