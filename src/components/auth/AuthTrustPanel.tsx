import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

type AuthTrustPanelProps = {
  title: string;
  summary: string;
  ctaHref: string;
  ctaLabel: string;
  artworkSrc?: string;
  artworkAlt?: string;
  eyebrow?: string;
};

const trustPoints = [
  "Skillsroom helps players use match rooms and tournaments without confusion.",
  "Proof, disputes, and payouts stay connected to the same match or event.",
  "You can read the rules, support pages, and community pages before you sign in."
] as const;

const quickLinks = [
  { href: "/community", label: "Community" },
  { href: "/policies", label: "Policies" },
  { href: "/rules", label: "Competition rules" },
  { href: "/support", label: "Support" }
] as const;

export function AuthTrustPanel({
  title,
  summary,
  ctaHref,
  ctaLabel,
  artworkSrc,
  artworkAlt = "Skillsroom artwork",
  eyebrow = "Skillsroom"
}: AuthTrustPanelProps) {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#08131f] text-white shadow-[0_40px_120px_rgba(4,10,20,0.35)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,197,138,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(33,170,255,0.16),transparent_38%)]" />
      <div className="relative grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(260px,38%)]">
        <div className="p-6 sm:p-7">
          <Badge tone="cyan">{eyebrow}</Badge>
          <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">{summary}</p>

          <div className="mt-6 grid gap-3">
            {trustPoints.map((item) => (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-200 backdrop-blur" key={item}>
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

          <div className="mt-6 rounded-[1.25rem] border border-cyan/25 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">New here?</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              You can look around first before making an account.
            </p>
            <Link
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover"
              href={ctaHref}
            >
              {ctaLabel}
            </Link>
          </div>
        </div>

        <div className="relative min-h-[280px] border-t border-white/10 xl:min-h-full xl:border-l xl:border-t-0">
          {artworkSrc ? (
            <>
              <Image alt={artworkAlt} className="object-cover" fill priority sizes="(min-width: 1280px) 28vw, 100vw" src={artworkSrc} />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#08131f]/78" />
            </>
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(24,197,138,0.18),transparent_32%),radial-gradient(circle_at_top,rgba(33,170,255,0.18),transparent_30%),linear-gradient(180deg,#0d1a28_0%,#08131f_100%)]" />
          )}
          <div className="absolute inset-x-4 bottom-4 grid gap-3 sm:inset-x-5">
            <div className="rounded-2xl border border-white/10 bg-[#09131f]/78 p-4 backdrop-blur">
              <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">One account</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                Use one account for rooms, tournament check-ins, disputes, and your profile.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#09131f]/78 p-4 backdrop-blur">
              <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Easy to check</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                Your rules, support pages, and account activity are easy to follow in one place.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
