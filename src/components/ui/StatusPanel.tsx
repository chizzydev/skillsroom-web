type StatusPanelProps = {
  label: string;
  value: string;
  tone: "cyan" | "success" | "warning" | "danger" | "neutral";
  detail?: string;
};

const toneClass: Record<StatusPanelProps["tone"], string> = {
  cyan: "text-cyan",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-ink"
};

const barClass: Record<StatusPanelProps["tone"], string> = {
  cyan: "bg-cyan",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-lineStrong"
};

export function StatusPanel({ label, value, tone, detail }: StatusPanelProps) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[1.2rem] border border-line bg-white px-4 py-4 shadow-[0_16px_40px_rgba(3,10,20,0.08)] sm:px-5">
      <span className={["absolute inset-x-0 top-0 h-1", barClass[tone]].join(" ")} />
      <span className="font-mono text-[0.68rem] font-black uppercase tracking-[0.12em] text-dim">{label}</span>
      <strong className={["mt-2 block break-words text-[1.9rem] font-black leading-none sm:text-[2.2rem]", toneClass[tone]].join(" ")}>
        {value}
      </strong>
      {detail ? <span className="mt-2 block text-xs leading-5 font-semibold text-muted sm:text-[0.82rem]">{detail}</span> : null}
    </div>
  );
}
