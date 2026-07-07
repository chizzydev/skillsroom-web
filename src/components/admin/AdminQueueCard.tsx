import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { CountUp } from "@/components/motion";

type AdminQueueCardProps = {
  label: string;
  value: string;
  detail: string;
  href: string;
  tone?: BadgeTone;
};

export function AdminQueueCard({ label, value, detail, href, tone = "cyan" }: AdminQueueCardProps) {
  const hasWork = Number.parseInt(value, 10) > 0;

  return (
    <Link
      className="motion-admin-queue-card group rounded-lg border border-line bg-white p-4 shadow-tight"
      data-has-work={hasWork ? "true" : "false"}
      href={href}
    >
      <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">{label}</span>
      <div className="mt-4 flex items-end justify-between gap-3">
        <strong className="text-3xl font-black leading-none text-ink"><CountUp value={value} /></strong>
        <Badge glow={hasWork} tone={tone}>{hasWork ? "Needs review" : "Clear"}</Badge>
      </div>
      <p className="mt-3 text-sm font-bold leading-5 text-muted">{detail}</p>
    </Link>
  );
}
