"use server";

import { redirect } from "next/navigation";
import { adminActionErrorMessage } from "@/lib/admin-action-errors";
import { requireAdminStepUpToken } from "@/lib/admin-step-up-session";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth-bridge";
import { updateAdminTeamMemberRole, type TeamRole } from "@/lib/match-room-api";

async function withError(error: unknown) {
  return `/admin/team?error=${encodeURIComponent(await adminActionErrorMessage(error, "Team role update could not be completed."))}`;
}

function assignableRole(value: FormDataEntryValue | null): Exclude<TeamRole, "owner"> {
  const role = String(value || "player");
  if (role === "player" || role === "support" || role === "moderator" || role === "admin") return role;
  throw new Error("Owner role is protected and cannot be assigned here.");
}

export async function updateTeamRoleAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!canAccessAdmin(user) || user?.role !== "owner") {
      throw new Error("Only the platform owner can change team roles.");
    }

    const stepUpToken = await requireAdminStepUpToken();
    await updateAdminTeamMemberRole({
      userId: String(formData.get("user_id") || "").trim(),
      role: assignableRole(formData.get("role")),
      note: String(formData.get("note") || "").trim() || undefined,
      stepUpToken
    });
  } catch (error) {
    redirect(await withError(error));
  }

  redirect("/admin/team?role_updated=1");
}
