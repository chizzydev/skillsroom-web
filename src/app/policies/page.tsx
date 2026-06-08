import type { Metadata } from "next";
import Link from "next/link";
import { policyEntries } from "@/lib/policies";

export const metadata: Metadata = {
  title: "Policies | Skillsroom",
  description: "Public legal, competition, refund, dispute, eligibility, and compliance policies for Skillsroom."
};

export default function PolicyHubPage() {
  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-6xl px-page py-8 md:py-12">
        <Link className="text-sm font-black text-muted hover:text-ink" href="/">
          Back to Skillsroom
        </Link>
        <section className="mt-6 rounded-lg border border-line bg-white p-5 shadow-panel md:p-7">
          <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Policy Hub</p>
          <h1 className="mt-3 text-3xl font-black leading-tight text-ink md:text-4xl">Legal and product policy pack</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:text-base">
            This is the public policy set for Skillsroom before launch: terms, competition rules, prizes, refunds, disputes, conduct, eligibility, privacy, trust, support, and compliance posture.
          </p>
          <div className="mt-4 rounded-md border border-warning/30 bg-warningSoft p-4 text-sm leading-6 text-muted">
            These policies are written as the product baseline for closed beta and launch preparation. They should receive formal legal review before public launch.
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {policyEntries.map((policy) => (
            <Link className="rounded-lg border border-line bg-white p-5 shadow-tight hover:bg-surfaceHigh" href={policy.path} key={policy.slug}>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan">{policy.eyebrow}</p>
              <h2 className="mt-2 text-xl font-black text-ink">{policy.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{policy.summary}</p>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-muted">Updated {policy.updatedAt}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
