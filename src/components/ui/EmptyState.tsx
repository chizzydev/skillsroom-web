import { Button } from "./Button";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  tone?: "neutral" | "cyan" | "warning" | "danger";
};

const toneClass: Record<NonNullable<EmptyStateProps["tone"]>, { shell: string; accent: string; chip: string }> = {
  neutral: {
    shell: "border-white/10 bg-[#0d1a28] text-white",
    accent: "from-cyan/20 via-transparent to-emerald-400/10",
    chip: "border-white/10 bg-white/10 text-slate-200"
  },
  cyan: {
    shell: "border-cyan/30 bg-[#0a1b28] text-white",
    accent: "from-cyan/25 via-transparent to-sky-400/10",
    chip: "border-cyan/20 bg-cyan/10 text-cyan-100"
  },
  warning: {
    shell: "border-orange-300/30 bg-[#21180f] text-white",
    accent: "from-orange-400/20 via-transparent to-yellow-300/10",
    chip: "border-orange-200/20 bg-orange-400/10 text-orange-100"
  },
  danger: {
    shell: "border-red-300/30 bg-[#241015] text-white",
    accent: "from-red-400/20 via-transparent to-rose-300/10",
    chip: "border-red-200/20 bg-red-400/10 text-red-100"
  }
};

export function EmptyState({ title, description, actionLabel, tone = "neutral" }: EmptyStateProps) {
  const toneStyles = toneClass[tone];

  return (
    <div className={["relative overflow-hidden rounded-[1.35rem] border p-8 text-center shadow-[0_24px_80px_rgba(3,10,20,0.18)]", toneStyles.shell].join(" ")}>
      <div className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--tw-gradient-stops))] ${toneStyles.accent}`} />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="relative mx-auto grid max-w-md place-items-center">
        <span className={["inline-flex rounded-full border px-3 py-1 font-mono text-[0.68rem] font-black uppercase tracking-[0.18em]", toneStyles.chip].join(" ")}>
          Stand by
        </span>
        <h3 className="mt-4 text-xl font-black text-current">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
        {actionLabel ? (
          <Button className="mt-5 border-white/10 bg-white/10 text-white hover:bg-white/15" size="sm" type="button" variant="secondary">
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
