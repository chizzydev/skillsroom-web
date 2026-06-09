import { getAdminStepUpState } from "@/lib/admin-step-up-session";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { clearAdminStepUpAction, confirmAdminStepUpAction } from "./step-up-actions";

type AdminStepUpPanelProps = {
  returnTo: string;
  title?: string;
  description?: string;
};

export async function AdminStepUpPanel({
  returnTo,
  title = "Unlock sensitive actions",
  description = "Confirm your current Skillsroom password once. The unlock stays active for about 10 minutes and is tied to this browser session."
}: AdminStepUpPanelProps) {
  const state = await getAdminStepUpState();

  return (
    <Panel>
      <PanelHeader
        eyebrow="Security"
        title={title}
        description={description}
        action={<Badge tone={state.unlocked ? "success" : "warning"}>{state.unlocked ? "Unlocked" : "Locked"}</Badge>}
      />
      <div className="grid gap-3 p-4">
        {state.unlocked ? (
          <>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-success">
              Sensitive actions are unlocked for this session until {new Date(state.expiresAt).toLocaleString("en-NG")}.
            </div>
            <form action={clearAdminStepUpAction} className="flex flex-wrap gap-3">
              <input name="return_to" type="hidden" value={returnTo} />
              <Button type="submit" variant="secondary">Lock sensitive actions</Button>
            </form>
          </>
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
