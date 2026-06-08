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
    <div className="relative min-w-0 overflow-hidden rounded-md border border-line bg-white p-4 shadow-tight">
      <span className={["absolute inset-x-0 top-0 h-1", barClass[tone]].join(" ")} />
      <span className="font-mono text-[0.68rem] font-black uppercase tracking-[0.12em] text-dim">{label}</span>
      <strong className={["mt-2 block break-words text-3xl font-black leading-none", toneClass[tone]].join(" ")}>{value}</strong>
      {detail ? <span className="mt-1 block text-xs font-semibold text-muted">{detail}</span> : null}
    </div>
  );
}
