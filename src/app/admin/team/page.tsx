import { redirect } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStepUpPanel } from "@/components/admin/AdminStepUpPanel";
import { AdminShell } from "@/components/layout/AdminShell";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { FormActionButton } from "@/components/ui/FormActionButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { TransientStatusBanner } from "@/components/ui/TransientStatusBanner";
import { canAccessAdmin, getCurrentUser } from "@/lib/auth-bridge";
import { listAdminTeamMembers, type AdminTeamMember, type TeamRole } from "@/lib/match-room-api";
import { updateTeamRoleAction } from "./actions";

export const dynamic = "force-dynamic";

const roleDescriptions: Record<TeamRole, string> = {
  owner: "Full platform control. Kept to the single platform owner account.",
  admin: "Money movement, funding decisions, settlements, refunds, and high-risk operations.",
  moderator: "Evidence, result review, disputes, room holds, and player-risk decisions.",
  support: "Player support context, queue visibility, and low-risk notes.",
  player: "Normal player account with no admin workspace access."
};

function roleTone(role: TeamRole): BadgeTone {
  if (role === "owner") return "success";
  if (role === "admin") return "cyan";
  if (role === "moderator") return "warning";
  if (role === "support") return "neutral";
  return "neutral";
}

function statusTone(status: AdminTeamMember["user_status"]): BadgeTone {
  if (status === "active") return "success";
  if (status === "locked") return "warning";
  return "danger";
}

function displayName(member: AdminTeamMember) {
  return member.username ?? member.profile_display_name ?? member.display_name ?? member.email ?? member.user_id;
}

export default async function AdminTeamPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; role_updated?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) redirect("/sign-in?redirect=/admin/team");

  let members: AdminTeamMember[] = [];
  let loadError: string | null = null;
  if (user?.role === "owner") {
    try {
      members = (await listAdminTeamMembers()).members;
    } catch {
      loadError = "Unable to load team roles.";
    }
  }

  const ownerCount = members.filter((member) => member.user_role === "owner").length;
  const adminCount = members.filter((member) => member.user_role === "admin").length;
  const moderatorCount = members.filter((member) => member.user_role === "moderator").length;
  const supportCount = members.filter((member) => member.user_role === "support").length;

  return (
    <AdminShell active="team">
      <section className="grid gap-5">
        <AdminPageHeader
          description="Assign scoped operations roles from inside Skillsroom. Owner stays protected; admins, moderators, and support can be granted without manual database edits."
          eyebrow="Owner Workspace"
          title="Team Role Management"
        />

        {params?.error ? <TransientStatusBanner clearKeys={["error"]} durationMs={14000} message={params.error} tone="danger" /> : null}
        {params?.role_updated ? <TransientStatusBanner clearKeys={["role_updated"]} durationMs={12000} message="Team role updated." tone="success" /> : null}
        {loadError ? <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadError}</div> : null}

        {user?.role !== "owner" ? (
          <Panel>
            <div className="p-4">
              <AdminEmptyState
                description="Only the platform owner can view and change team roles. Other admin roles keep their normal workspace access."
                title="Owner access required"
              />
            </div>
          </Panel>
        ) : (
          <>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatusPanel detail="Protected account" label="Owner" tone="success" value={ownerCount.toString()} />
              <StatusPanel detail="Money operations" label="Admins" tone="cyan" value={adminCount.toString()} />
              <StatusPanel detail="Evidence and disputes" label="Moderators" tone="warning" value={moderatorCount.toString()} />
              <StatusPanel detail="Player context" label="Support" tone="neutral" value={supportCount.toString()} />
            </div>

            <AdminStepUpPanel
              returnTo="/admin/team"
              title="Unlock role changes"
              description="Confirm your current Skillsroom password before changing team roles. The unlock stays active for about 1 hour and can be locked manually."
            />

            <Panel>
              <PanelHeader
                description="Role changes update the user account and team membership together, then write an auth audit event for traceability."
                eyebrow="Team"
                title="Members and roles"
              />
              {members.length ? (
                <DataTable
                  columns={[
                    {
                      key: "user",
                      label: "User",
                      render: (member) => (
                        <div className="min-w-56">
                          <strong className="block text-ink">{displayName(member)}</strong>
                          <span className="mt-1 block text-xs font-bold text-muted">{member.email ?? "No email supplied"}</span>
                          <span className="mt-1 block font-mono text-[0.68rem] font-bold text-dim">{member.user_id}</span>
                        </div>
                      )
                    },
                    {
                      key: "role",
                      label: "Current role",
                      render: (member) => (
                        <div className="grid gap-2">
                          <Badge tone={roleTone(member.user_role)}>{member.user_role}</Badge>
                          <Badge tone={statusTone(member.user_status)}>{member.user_status}</Badge>
                        </div>
                      )
                    },
                    {
                      key: "scope",
                      label: "Scope",
                      render: (member) => (
                        <p className="max-w-xs text-sm font-bold leading-6 text-muted">
                          {member.is_platform_owner ? "Single protected platform owner." : roleDescriptions[member.user_role]}
                        </p>
                      )
                    },
                    {
                      key: "action",
                      label: "Assign",
                      render: (member) =>
                        member.is_platform_owner ? (
                          <p className="max-w-xs text-sm font-bold leading-6 text-muted">
                            Owner is intentionally locked. Use this page for scoped operator roles only.
                          </p>
                        ) : (
                          <form action={updateTeamRoleAction} className="grid min-w-64 gap-2">
                            <input name="user_id" type="hidden" value={member.user_id} />
                            <select
                              className="min-h-10 rounded-md border border-line bg-white px-3 text-sm font-bold outline-none focus:border-action"
                              defaultValue={member.user_role === "owner" ? "player" : member.user_role}
                              name="role"
                            >
                              <option value="player">Player</option>
                              <option value="support">Support</option>
                              <option value="moderator">Moderator</option>
                              <option value="admin">Admin</option>
                            </select>
                            <input
                              className="min-h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                              maxLength={500}
                              name="note"
                              placeholder="Reason or approval note"
                            />
                            <FormActionButton idleLabel="Update role" pendingLabel="Updating role..." size="sm" />
                          </form>
                        )
                    }
                  ]}
                  rows={members}
                />
              ) : (
                <div className="p-4">
                  <AdminEmptyState description="Registered users will appear here once the API returns team records." title="No team members loaded" />
                </div>
              )}
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Role Guide" title="Operational role boundaries" />
              <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
                {(Object.keys(roleDescriptions) as TeamRole[]).map((role) => (
                  <div className="rounded-md border border-line bg-white p-4" key={role}>
                    <Badge tone={roleTone(role)}>{role}</Badge>
                    <p className="mt-3 text-sm font-bold leading-6 text-muted">{roleDescriptions[role]}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </>
        )}
      </section>
    </AdminShell>
  );
}
