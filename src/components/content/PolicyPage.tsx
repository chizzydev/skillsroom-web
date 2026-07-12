import Link from "next/link";
import type { PolicyEntry } from "@/lib/policies";

type PolicyPageProps = {
  policy: PolicyEntry;
  related?: Array<Pick<PolicyEntry, "path" | "title" | "eyebrow" | "summary">>;
};

export function PolicyPage({ policy, related = [] }: PolicyPageProps) {
  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-6xl px-page py-8 md:py-12">
        <Link className="text-sm font-black text-muted hover:text-ink" href="/">
          Back to Skillsroom
        </Link>
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <section className="rounded-lg border border-line bg-white p-5 shadow-panel md:p-7">
              <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">{policy.eyebrow}</p>
              <h1 className="mt-3 text-3xl font-black leading-tight text-ink md:text-4xl">{policy.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:text-base">{policy.description}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <p className="text-sm leading-6 text-muted">{policy.summary}</p>
                <div className="rounded-md border border-line bg-surfaceWarm px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-muted">
                  Updated {policy.updatedAt}
                </div>
              </div>
            </section>
            <section className="mt-5 rounded-lg border border-cyan/30 bg-cyanSoft p-4 shadow-tight">
              <p className="text-sm font-black text-ink">Player guide</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                Use this page to understand how Skillsroom handles rooms, tournaments, evidence, refunds, support, and account activity.
              </p>
            </section>
            <section className="mt-5 grid gap-4">
              {policy.sections.map((section) => (
                <article className="rounded-md border border-line bg-white p-5 shadow-tight" key={section.title}>
                  <h2 className="text-lg font-black text-ink">{section.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{section.body}</p>
                  {section.bullets?.length ? (
                    <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted">
                      {section.bullets.map((bullet) => (
                        <li className="grid grid-cols-[0.75rem_1fr] gap-2" key={bullet}>
                          <span className="mt-2 h-2 w-2 rounded-full bg-action" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </section>
          </div>
          <aside className="grid h-fit gap-4 xl:sticky xl:top-24">
            <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Guide Set</p>
              <div className="mt-3 grid gap-2">
                <Link className="rounded-md border border-line bg-white px-3 py-2 text-sm font-black text-ink hover:bg-surfaceHigh" href="/policies">
                  Open guide hub
                </Link>
                <Link className="rounded-md border border-line bg-white px-3 py-2 text-sm font-black text-ink hover:bg-surfaceHigh" href="/support">
                  Support guide
                </Link>
                <Link className="rounded-md border border-line bg-white px-3 py-2 text-sm font-black text-ink hover:bg-surfaceHigh" href="/compliance">
                  Skill-gaming notes
                </Link>
              </div>
            </section>
            {related.length ? (
              <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted">Related</p>
                <div className="mt-3 grid gap-3">
                  {related.slice(0, 6).map((entry) => (
                    <Link className="rounded-md border border-line bg-white p-3 hover:bg-surfaceHigh" href={entry.path} key={entry.path}>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-cyan">{entry.eyebrow}</p>
                      <p className="mt-1 text-sm font-black text-ink">{entry.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted">{entry.summary}</p>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
