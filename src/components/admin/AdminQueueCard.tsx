import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

type AdminQueueCardProps = {
  label: string;
  value: string;
  detail: string;
  href: string;
  tone?: BadgeTone;
};

export function AdminQueueCard({ label, value, detail, href, tone = "cyan" }: AdminQueueCardProps) {
  return (
    <Link
      className="group rounded-lg border border-line bg-white p-4 shadow-tight transition hover:-translate-y-0.5 hover:border-cyan hover:shadow-panel"
      href={href}
    >
      <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-dim">{label}</span>
      <div className="mt-4 flex items-end justify-between gap-3">
        <strong className="text-3xl font-black leading-none text-ink">{value}</strong>
        <Badge tone={tone}>Open</Badge>
      </div>
      <p className="mt-3 text-sm font-bold leading-5 text-muted">{detail}</p>
    </Link>
  );
}
