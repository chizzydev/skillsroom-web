"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatLagosDateTime } from "@/lib/date-format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { clearAdminStepUpAction, confirmAdminStepUpAction } from "./step-up-actions";

type AdminStepUpPanelClientProps = {
  description: string;
  expiresAt: string | null;
  returnTo: string;
  title: string;
  unlocked: boolean;
};

function formatRemaining(msRemaining: number) {
  const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function AdminStepUpPanelClient({
  description,
  expiresAt,
  returnTo,
  title,
  unlocked
}: AdminStepUpPanelClientProps) {
  const router = useRouter();
  const expiryMs = expiresAt ? new Date(expiresAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  const [refreshingAfterExpiry, setRefreshingAfterExpiry] = useState(false);

  const active = useMemo(() => {
    return Boolean(unlocked && expiryMs && expiryMs > now);
  }, [expiryMs, now, unlocked]);

  useEffect(() => {
    if (!unlocked || !expiryMs) return;

    const tick = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(tick);
  }, [expiryMs, unlocked]);

  useEffect(() => {
    if (active || !unlocked || !expiryMs || refreshingAfterExpiry) return;
    setRefreshingAfterExpiry(true);
    router.refresh();
  }, [active, expiryMs, refreshingAfterExpiry, router, unlocked]);

  const remainingLabel = expiryMs && active ? formatRemaining(expiryMs - now) : null;

  return (
    <Panel>
      <PanelHeader
        eyebrow="Security"
        title={title}
        description={description}
        action={<Badge tone={active ? "success" : "warning"}>{active ? "Unlocked" : "Locked"}</Badge>}
      />
      <div className="grid gap-3 p-4">
        {active ? (
          <>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-success">
              <p>Sensitive actions are unlocked for this session until {formatLagosDateTime(expiresAt!)}.</p>
              {remainingLabel ? <p className="mt-1 text-xs font-bold text-emerald-700">Auto-locks in {remainingLabel}.</p> : null}
            </div>
            <form action={clearAdminStepUpAction} className="flex flex-wrap gap-3">
              <input name="return_to" type="hidden" value={returnTo} />
              <Button type="submit" variant="secondary">Lock sensitive actions</Button>
            </form>
          </>
        ) : unlocked ? (
          <div className="grid gap-3">
            <div className="rounded-md border border-orange-200 bg-warningSoft p-3 text-sm font-bold text-warning">
              Sensitive actions expired at {expiresAt ? formatLagosDateTime(expiresAt) : "the end of the unlock window"}. Confirm your password again to continue.
            </div>
            <Button onClick={() => router.refresh()} type="button" variant="secondary">
              Reload unlock panel
            </Button>
          </div>
        ) : (
          <form action={confirmAdminStepUpAction} className="grid gap-3">
            <input name="return_to" type="hidden" value={returnTo} />
            <label className="grid gap-2 text-sm font-bold text-ink">
              Confirm password
              <input
                autoComplete="current-password"
                className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                name="password"
                placeholder="Your current Skillsroom password"
                required
                type="password"
              />
            </label>
            <p className="text-xs font-bold text-muted">
              This is for your Skillsroom password confirmation, not a Google popup or one-time code.
            </p>
            <Button type="submit">Unlock sensitive actions</Button>
          </form>
        )}
      </div>
    </Panel>
  );
}
