import { getAdminStepUpState } from "@/lib/admin-step-up-session";
import { AdminStepUpPanelClient } from "./AdminStepUpPanelClient";

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
    <AdminStepUpPanelClient
      description={description}
      expiresAt={state.expiresAt}
      returnTo={returnTo}
      title={title}
      unlocked={state.unlocked}
    />
  );
}
