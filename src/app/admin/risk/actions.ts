"use server";

import { redirect } from "next/navigation";
import { apiBaseUrl } from "@/lib/api";
import { canAccessAdmin, getAccessToken, getCurrentUser } from "@/lib/auth-bridge";
import {
  approveEvidenceDeletion,
  permanentlyDeleteEvidenceFile,
  quarantineEvidenceFile,
  requestEvidenceDeletion,
  restoreQuarantinedEvidenceFile,
  setEvidenceLegalHold
} from "@/lib/evidence-storage";
import {
  ApiRequestError,
  createModerationAction,
  createRiskFlag,
  createRoomHold,
  releaseRoomHold,
  updateRiskFlagStatus,
  type ModerationAction,
  type RoomModerationHold,
  type UserRiskFlag
} from "@/lib/match-room-api";

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return "The risk action could not be completed.";
}

function withError(error: unknown) {
  return `/admin/risk?error=${encodeURIComponent(actionErrorMessage(error))}`;
}

function appOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
}

function canChangeLegalHold(role: string) {
  return ["moderator", "admin", "owner"].includes(role);
}

function canApproveDeletion(role: string) {
  return ["admin", "owner"].includes(role);
}

type EvidenceMutationResult =
  | Awaited<ReturnType<typeof setEvidenceLegalHold>>
  | Awaited<ReturnType<typeof quarantineEvidenceFile>>
  | Awaited<ReturnType<typeof restoreQuarantinedEvidenceFile>>
  | Awaited<ReturnType<typeof requestEvidenceDeletion>>
  | Awaited<ReturnType<typeof approveEvidenceDeletion>>
  | Awaited<ReturnType<typeof permanentlyDeleteEvidenceFile>>;

async function recordEvidenceMutationAudit(input: {
  token: string;
  action:
    | "legal_hold_applied"
    | "legal_hold_released"
    | "quarantined"
    | "restored"
    | "deletion_requested"
    | "deletion_approved"
    | "deletion_rejected"
    | "deleted";
  reason: string;
  result: EvidenceMutationResult;
}) {
  try {
    await fetch(`${apiBaseUrl()}/evidence/access-events`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${input.token}`,
        "content-type": "application/json",
        origin: appOrigin()
      },
      body: JSON.stringify({
        file_name: input.result.metadata.fileName,
        storage: "hardened",
        action: input.action,
        reason: input.reason,
        status_code: 200,
        context_type: input.result.metadata.contextType,
        context_id: input.result.metadata.contextId,
        uploaded_by_user_id: input.result.metadata.uploadedByUserId,
        evidence_type: input.result.metadata.evidenceType,
        mime_type: input.result.metadata.mimeType,
        byte_size: input.result.metadata.byteSize,
        sha256: input.result.metadata.sha256,
        retention_state: input.result.state,
        retain_until: input.result.retention.retainUntil,
        legal_hold: input.result.retention.legalHold
      }),
      cache: "no-store"
    });
  } catch {
    // Legal hold state is stored locally even if the remote audit sink is temporarily unavailable.
  }
}

export async function createRiskFlagAction(formData: FormData) {
  try {
    await createRiskFlag({
      user_id: String(formData.get("user_id") || "").trim(),
      flag_type: String(formData.get("flag_type") || "").trim(),
      severity: String(formData.get("severity") || "medium") as UserRiskFlag["severity"],
      summary: String(formData.get("summary") || "").trim()
    });
  } catch (error) {
    redirect(withError(error));
  }
  redirect("/admin/risk");
}

export async function updateRiskFlagStatusAction(formData: FormData) {
  try {
    await updateRiskFlagStatus(
      String(formData.get("flag_id") || ""),
      String(formData.get("status") || "reviewing") as UserRiskFlag["status"]
    );
  } catch (error) {
    redirect(withError(error));
  }
  redirect("/admin/risk");
}

export async function createModerationActionAction(formData: FormData) {
  try {
    await createModerationAction({
      target_user_id: String(formData.get("target_user_id") || "").trim() || undefined,
      match_room_id: String(formData.get("match_room_id") || "").trim() || undefined,
      action_type: String(formData.get("action_type") || "warn") as ModerationAction["action_type"],
      severity: String(formData.get("severity") || "medium") as ModerationAction["severity"],
      summary: String(formData.get("summary") || "").trim(),
      stepUpToken: String(formData.get("step_up_token") || "").trim()
    });
  } catch (error) {
    redirect(withError(error));
  }
  redirect("/admin/risk");
}

export async function createRoomHoldAction(formData: FormData) {
  try {
    await createRoomHold({
      match_room_id: String(formData.get("match_room_id") || "").trim(),
      severity: String(formData.get("severity") || "medium") as RoomModerationHold["severity"],
      reason: String(formData.get("reason") || "").trim()
    });
  } catch (error) {
    redirect(withError(error));
  }
  redirect("/admin/risk");
}

export async function releaseRoomHoldAction(formData: FormData) {
  try {
    await releaseRoomHold(
      String(formData.get("hold_id") || "").trim(),
      String(formData.get("release_note") || "").trim() || undefined
    );
  } catch (error) {
    redirect(withError(error));
  }
  redirect("/admin/risk");
}

export async function updateEvidenceLegalHoldAction(formData: FormData) {
  try {
    const [user, token] = await Promise.all([getCurrentUser(), getAccessToken()]);
    if (!canAccessAdmin(user) || !user || !token || !canChangeLegalHold(user.role)) {
      throw new Error("Moderator access is required to change evidence legal hold.");
    }

    const enabled = String(formData.get("legal_hold_action") || "apply") === "apply";
    const reason = String(formData.get("legal_hold_reason") || "").trim();
    const result = await setEvidenceLegalHold({
      fileName: String(formData.get("evidence_file_name") || "").trim(),
      enabled,
      actorUserId: user.id,
      reason
    });

    await recordEvidenceMutationAudit({
      token,
      action: enabled ? "legal_hold_applied" : "legal_hold_released",
      reason: enabled ? "legal_hold_applied" : "legal_hold_released",
      result
    });
  } catch (error) {
    redirect(withError(error));
  }
  redirect("/admin/risk");
}

export async function updateEvidenceQuarantineAction(formData: FormData) {
  try {
    const [user, token] = await Promise.all([getCurrentUser(), getAccessToken()]);
    if (!canAccessAdmin(user) || !user || !token || !canChangeLegalHold(user.role)) {
      throw new Error("Moderator access is required to quarantine evidence.");
    }

    const action = String(formData.get("quarantine_action") || "quarantine");
    const note = String(formData.get("quarantine_note") || "").trim();
    const fileName = String(formData.get("evidence_file_name") || "").trim();
    const result =
      action === "restore"
        ? await restoreQuarantinedEvidenceFile({ fileName, actorUserId: user.id, note })
        : await quarantineEvidenceFile({
            fileName,
            actorUserId: user.id,
            reason: String(formData.get("quarantine_reason") || "operator_quarantine") === "retention_expired" ? "retention_expired" : "operator_quarantine",
            note
          });

    await recordEvidenceMutationAudit({
      token,
      action: action === "restore" ? "restored" : "quarantined",
      reason: action === "restore" ? "operator_restore" : result.cleanup.reason ?? "operator_quarantine",
      result
    });
  } catch (error) {
    redirect(withError(error));
  }
  redirect("/admin/risk");
}

export async function updateEvidenceDeletionAction(formData: FormData) {
  try {
    const [user, token] = await Promise.all([getCurrentUser(), getAccessToken()]);
    if (!canAccessAdmin(user) || !user || !token || !canChangeLegalHold(user.role)) {
      throw new Error("Moderator access is required to request evidence deletion.");
    }

    const action = String(formData.get("deletion_action") || "request");
    const fileName = String(formData.get("evidence_file_name") || "").trim();
    const note = String(formData.get("deletion_note") || "").trim();
    let auditAction: "deletion_requested" | "deletion_approved" | "deletion_rejected" | "deleted";
    let result: EvidenceMutationResult;

    if (action === "request") {
      result = await requestEvidenceDeletion({ fileName, actorUserId: user.id, note });
      auditAction = "deletion_requested";
    } else {
      if (!canApproveDeletion(user.role)) {
        throw new Error("Admin or owner access is required to approve, reject, or execute permanent deletion.");
      }

      if (action === "approve") {
        result = await approveEvidenceDeletion({ fileName, actorUserId: user.id, note, approve: true });
        auditAction = "deletion_approved";
      } else if (action === "reject") {
        result = await approveEvidenceDeletion({ fileName, actorUserId: user.id, note, approve: false });
        auditAction = "deletion_rejected";
      } else {
        result = await permanentlyDeleteEvidenceFile({
          fileName,
          actorUserId: user.id,
          confirmation: String(formData.get("deletion_confirmation") || ""),
          note
        });
        auditAction = "deleted";
      }
    }

    await recordEvidenceMutationAudit({
      token,
      action: auditAction,
      reason: auditAction,
      result
    });
  } catch (error) {
    redirect(withError(error));
  }
  redirect("/admin/risk");
}
