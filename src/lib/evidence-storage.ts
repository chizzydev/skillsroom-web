import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import type { EvidenceItemType } from "./match-room-api";
import {
  evidenceStorageProvider,
  evidenceStorageProviderStatus,
  localEvidenceMetadataPath,
  localEvidenceStoragePath
} from "./evidence-storage-provider";

const dayMs = 24 * 60 * 60 * 1000;

export const evidenceRetentionPolicy = {
  policyId: "closed_beta_evidence_retention_v1",
  defaultRetentionDays: 180,
  legacyReviewDays: 30
} as const;

export const evidenceCleanupPolicy = {
  policyId: "closed_beta_evidence_cleanup_v1",
  mode: "quarantine_then_approved_media_delete",
  expiredQuarantineGraceDays: 0,
  metadataErrorHandling: "manual_review",
  deletionConfirmationPhrase: "DELETE EVIDENCE"
} as const;

type EvidenceRule = {
  extension: string;
  evidenceType: EvidenceItemType;
  maxBytes: number;
  matches: (bytes: Buffer) => boolean;
};

export type StoredEvidenceMetadata = {
  version: 1;
  fileName: string;
  contextId: string;
  contextType: "match_room" | "tournament";
  uploadedByUserId: string;
  mimeType: string;
  evidenceType: EvidenceItemType;
  byteSize: number;
  sha256: string;
  createdAt: string;
  retention?: StoredEvidenceRetention;
  storage?: StoredEvidenceStorage;
  cleanup?: StoredEvidenceCleanup;
};

export type StoredEvidenceStorage = {
  provider: ReturnType<typeof evidenceStorageProviderStatus>["provider"];
  objectKey: string;
  metadataObjectKey: string;
};

export type StoredEvidenceRetention = {
  policyId: typeof evidenceRetentionPolicy.policyId;
  retentionDays: number;
  retainUntil: string;
  legalHold: boolean;
  reason: "match_room_evidence" | "tournament_evidence";
  legalHoldReason?: string;
  legalHoldByUserId?: string;
  legalHoldAt?: string;
  legalHoldReleasedByUserId?: string;
  legalHoldReleasedAt?: string;
};

export type StoredEvidenceCleanup = {
  policyId: typeof evidenceCleanupPolicy.policyId;
  status: "active" | "quarantined" | "deletion_requested" | "deletion_approved" | "deleted";
  reason?: "retention_expired" | "operator_quarantine" | "permanent_deletion";
  note?: string;
  quarantinedByUserId?: string;
  quarantinedAt?: string;
  originalObjectKey?: string;
  quarantineObjectKey?: string;
  restoredByUserId?: string;
  restoredAt?: string;
  deletionRequestedByUserId?: string;
  deletionRequestedAt?: string;
  deletionRequestNote?: string;
  deletionApprovedByUserId?: string;
  deletionApprovedAt?: string;
  deletionApprovalNote?: string;
  deletedByUserId?: string;
  deletedAt?: string;
  deletedObjectKey?: string;
};

export const evidenceFileNamePattern =
  /^evidence-v1_[A-Za-z0-9_-]{1,80}_[A-Za-z0-9_-]{1,80}_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|mp4|webm|mov)$/i;

export const legacyEvidenceFileNamePattern =
  /^[A-Za-z0-9_-]{1,80}_[A-Za-z0-9_-]{1,80}_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|mp4|webm|mov)$/i;

const allowedTypes = new Map<string, EvidenceRule>([
  ["image/jpeg", { extension: "jpg", evidenceType: "screenshot", maxBytes: 8 * 1024 * 1024, matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ["image/png", { extension: "png", evidenceType: "screenshot", maxBytes: 8 * 1024 * 1024, matches: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) }],
  ["image/webp", { extension: "webp", evidenceType: "screenshot", maxBytes: 8 * 1024 * 1024, matches: (bytes) => bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" }],
  ["video/mp4", { extension: "mp4", evidenceType: "video", maxBytes: 80 * 1024 * 1024, matches: (bytes) => bytes.subarray(4, 8).toString("ascii") === "ftyp" }],
  ["video/webm", { extension: "webm", evidenceType: "video", maxBytes: 80 * 1024 * 1024, matches: (bytes) => bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) }],
  ["video/quicktime", { extension: "mov", evidenceType: "video", maxBytes: 80 * 1024 * 1024, matches: (bytes) => bytes.subarray(4, 8).toString("ascii") === "ftyp" }]
]);

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "unknown";
}

export function evidenceStoragePath(fileName: string) {
  return localEvidenceStoragePath(fileName);
}

export function evidenceMetadataPath(fileName: string) {
  return localEvidenceMetadataPath(fileName);
}

export async function readEvidenceMetadata(fileName: string): Promise<StoredEvidenceMetadata> {
  return evidenceStorageProvider().readMetadata(fileName) as Promise<StoredEvidenceMetadata>;
}

async function writeEvidenceMetadata(metadata: StoredEvidenceMetadata) {
  await evidenceStorageProvider().writeMetadata(metadata.fileName, metadata);
}

export async function readEvidenceFile(fileName: string) {
  return evidenceStorageProvider().readFile(fileName);
}

export async function statEvidenceFile(fileName: string) {
  return evidenceStorageProvider().statFile(fileName);
}

function buildEvidenceStorageMetadata(fileName: string): StoredEvidenceStorage {
  const provider = evidenceStorageProvider();
  return {
    provider: provider.name,
    objectKey: provider.objectKey(fileName),
    metadataObjectKey: provider.metadataObjectKey(fileName)
  };
}

export function resolveEvidenceCleanup(metadata: StoredEvidenceMetadata): StoredEvidenceCleanup {
  return metadata.cleanup ?? {
    policyId: evidenceCleanupPolicy.policyId,
    status: "active"
  };
}

export function evidenceCleanupState(metadata: StoredEvidenceMetadata) {
  return resolveEvidenceCleanup(metadata).status;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * dayMs);
}

export function buildEvidenceRetention(input: {
  contextType: StoredEvidenceMetadata["contextType"];
  createdAt?: Date;
}): StoredEvidenceRetention {
  const createdAt = input.createdAt ?? new Date();
  return {
    policyId: evidenceRetentionPolicy.policyId,
    retentionDays: evidenceRetentionPolicy.defaultRetentionDays,
    retainUntil: addDays(createdAt, evidenceRetentionPolicy.defaultRetentionDays).toISOString(),
    legalHold: false,
    reason: input.contextType === "tournament" ? "tournament_evidence" : "match_room_evidence"
  };
}

export function resolveEvidenceRetention(metadata: StoredEvidenceMetadata): StoredEvidenceRetention {
  if (metadata.retention) return metadata.retention;
  return buildEvidenceRetention({
    contextType: metadata.contextType,
    createdAt: new Date(metadata.createdAt)
  });
}

export function evidenceRetentionState(
  metadata: StoredEvidenceMetadata,
  now = new Date()
): "active" | "expired" | "legal_hold" {
  const retention = resolveEvidenceRetention(metadata);
  if (retention.legalHold) return "legal_hold";
  return new Date(retention.retainUntil).getTime() <= now.getTime() ? "expired" : "active";
}

export async function listEvidenceRetentionReport(now = new Date()) {
  const provider = evidenceStorageProvider();
  const fileNames = await provider.listMetadataFileNames();
  const entries = await Promise.all(
    fileNames.map(async (fileName) => {
      try {
        const metadata = await readEvidenceMetadata(fileName);
        const retention = resolveEvidenceRetention(metadata);
        const state = evidenceRetentionState(metadata, now);
        const cleanup = resolveEvidenceCleanup(metadata);
        const cleanupEligible = state === "expired" && !retention.legalHold && cleanup.status === "active";
        const deletionEligible = state === "expired" && !retention.legalHold && cleanup.status === "quarantined";
        return {
          fileName,
          contextId: metadata.contextId,
          contextType: metadata.contextType,
          uploadedByUserId: metadata.uploadedByUserId,
          byteSize: metadata.byteSize,
          createdAt: metadata.createdAt,
          retainUntil: retention.retainUntil,
          legalHold: retention.legalHold,
          legalHoldReason: retention.legalHoldReason ?? null,
          legalHoldByUserId: retention.legalHoldByUserId ?? null,
          legalHoldAt: retention.legalHoldAt ?? null,
          legalHoldReleasedByUserId: retention.legalHoldReleasedByUserId ?? null,
          legalHoldReleasedAt: retention.legalHoldReleasedAt ?? null,
          policyId: retention.policyId,
          cleanupStatus: cleanup.status,
          cleanupEligible,
          deletionEligible,
          cleanupReason: cleanupEligible ? "retention_expired" : null,
          quarantinedAt: cleanup.quarantinedAt ?? null,
          quarantinedByUserId: cleanup.quarantinedByUserId ?? null,
          quarantineObjectKey: cleanup.quarantineObjectKey ?? null,
          deletionRequestedAt: cleanup.deletionRequestedAt ?? null,
          deletionRequestedByUserId: cleanup.deletionRequestedByUserId ?? null,
          deletionApprovedAt: cleanup.deletionApprovedAt ?? null,
          deletionApprovedByUserId: cleanup.deletionApprovedByUserId ?? null,
          deletedAt: cleanup.deletedAt ?? null,
          deletedByUserId: cleanup.deletedByUserId ?? null,
          deletedObjectKey: cleanup.deletedObjectKey ?? null,
          state
        };
      } catch {
        return {
          fileName,
          contextId: null,
          contextType: null,
          uploadedByUserId: null,
          byteSize: 0,
          createdAt: null,
          retainUntil: null,
          legalHold: false,
          legalHoldReason: null,
          legalHoldByUserId: null,
          legalHoldAt: null,
          legalHoldReleasedByUserId: null,
          legalHoldReleasedAt: null,
          policyId: null,
          cleanupStatus: "metadata_error" as const,
          cleanupEligible: false,
          deletionEligible: false,
          cleanupReason: "metadata_error" as const,
          quarantinedAt: null,
          quarantinedByUserId: null,
          quarantineObjectKey: null,
          deletionRequestedAt: null,
          deletionRequestedByUserId: null,
          deletionApprovedAt: null,
          deletionApprovedByUserId: null,
          deletedAt: null,
          deletedByUserId: null,
          deletedObjectKey: null,
          state: "metadata_error" as const
        };
      }
    })
  );

  return {
    generatedAt: now.toISOString(),
    policy: evidenceRetentionPolicy,
    storage: provider.status(),
    summary: {
      total: entries.length,
      active: entries.filter((entry) => entry.state === "active").length,
      expired: entries.filter((entry) => entry.state === "expired").length,
      legalHold: entries.filter((entry) => entry.state === "legal_hold").length,
      metadataError: entries.filter((entry) => entry.state === "metadata_error").length,
      cleanupEligible: entries.filter((entry) => entry.cleanupEligible).length,
      quarantined: entries.filter((entry) => ["quarantined", "deletion_requested", "deletion_approved"].includes(entry.cleanupStatus)).length,
      deletionEligible: entries.filter((entry) => entry.deletionEligible).length,
      deletionRequested: entries.filter((entry) => entry.cleanupStatus === "deletion_requested").length,
      deletionApproved: entries.filter((entry) => entry.cleanupStatus === "deletion_approved").length,
      deleted: entries.filter((entry) => entry.cleanupStatus === "deleted").length
    },
    entries
  };
}

export async function quarantineEvidenceFile(input: {
  fileName: string;
  actorUserId: string;
  reason: "retention_expired" | "operator_quarantine";
  note: string;
}) {
  const safeName = path.basename(input.fileName);
  if (safeName !== input.fileName || !evidenceFileNamePattern.test(safeName)) {
    throw new Error("Only hardened evidence files can be quarantined.");
  }

  const note = input.note.trim();
  if (note.length < 8) {
    throw new Error("Quarantine note must explain the cleanup or investigation reason.");
  }

  const metadata = await readEvidenceMetadata(safeName);
  const retention = resolveEvidenceRetention(metadata);
  const cleanup = resolveEvidenceCleanup(metadata);
  if (retention.legalHold) {
    throw new Error("Evidence under legal hold cannot be quarantined.");
  }

  if (cleanup.status !== "active") {
    return {
      metadata,
      retention,
      cleanup,
      state: evidenceRetentionState(metadata)
    };
  }

  const move = await evidenceStorageProvider().quarantineFile(safeName);
  const now = new Date().toISOString();
  metadata.cleanup = {
    policyId: evidenceCleanupPolicy.policyId,
    status: "quarantined",
    reason: input.reason,
    note,
    quarantinedByUserId: input.actorUserId,
    quarantinedAt: now,
    originalObjectKey: move.originalObjectKey,
    quarantineObjectKey: move.quarantineObjectKey,
    restoredByUserId: cleanup.restoredByUserId,
    restoredAt: cleanup.restoredAt
  };

  await writeEvidenceMetadata(metadata);
  return {
    metadata,
    retention,
    cleanup: metadata.cleanup,
    state: evidenceRetentionState(metadata)
  };
}

export async function restoreQuarantinedEvidenceFile(input: {
  fileName: string;
  actorUserId: string;
  note: string;
}) {
  const safeName = path.basename(input.fileName);
  if (safeName !== input.fileName || !evidenceFileNamePattern.test(safeName)) {
    throw new Error("Only hardened evidence files can be restored.");
  }

  const note = input.note.trim();
  if (note.length < 8) {
    throw new Error("Restore note must explain why the evidence should return to active storage.");
  }

  const metadata = await readEvidenceMetadata(safeName);
  const cleanup = resolveEvidenceCleanup(metadata);
  if (!["quarantined", "deletion_requested", "deletion_approved"].includes(cleanup.status)) {
    throw new Error("Evidence file is not currently quarantined.");
  }

  const move = await evidenceStorageProvider().restoreFile(safeName);
  const now = new Date().toISOString();
  metadata.cleanup = {
    ...cleanup,
    status: "active",
    note,
    restoredByUserId: input.actorUserId,
    restoredAt: now,
    originalObjectKey: move.objectKey,
    quarantineObjectKey: move.quarantineObjectKey
  };
  metadata.storage = buildEvidenceStorageMetadata(safeName);

  await writeEvidenceMetadata(metadata);
  return {
    metadata,
    retention: resolveEvidenceRetention(metadata),
    cleanup: metadata.cleanup,
    state: evidenceRetentionState(metadata)
  };
}

export async function requestEvidenceDeletion(input: {
  fileName: string;
  actorUserId: string;
  note: string;
}) {
  const safeName = path.basename(input.fileName);
  if (safeName !== input.fileName || !evidenceFileNamePattern.test(safeName)) {
    throw new Error("Only hardened evidence files can be submitted for deletion.");
  }

  const note = input.note.trim();
  if (note.length < 12) {
    throw new Error("Deletion request note must explain the permanent deletion reason.");
  }

  const metadata = await readEvidenceMetadata(safeName);
  const retention = resolveEvidenceRetention(metadata);
  const cleanup = resolveEvidenceCleanup(metadata);
  const state = evidenceRetentionState(metadata);
  if (retention.legalHold) throw new Error("Evidence under legal hold cannot be deleted.");
  if (state !== "expired") throw new Error("Only expired evidence can be submitted for permanent deletion.");
  if (cleanup.status !== "quarantined") throw new Error("Evidence must be quarantined before deletion can be requested.");

  metadata.cleanup = {
    ...cleanup,
    status: "deletion_requested",
    reason: "permanent_deletion",
    deletionRequestedByUserId: input.actorUserId,
    deletionRequestedAt: new Date().toISOString(),
    deletionRequestNote: note
  };
  await writeEvidenceMetadata(metadata);

  return { metadata, retention, cleanup: metadata.cleanup, state };
}

export async function approveEvidenceDeletion(input: {
  fileName: string;
  actorUserId: string;
  note: string;
  approve: boolean;
}) {
  const safeName = path.basename(input.fileName);
  if (safeName !== input.fileName || !evidenceFileNamePattern.test(safeName)) {
    throw new Error("Only hardened evidence files can receive deletion approval.");
  }

  const note = input.note.trim();
  if (note.length < 12) {
    throw new Error("Deletion approval note must explain the decision.");
  }

  const metadata = await readEvidenceMetadata(safeName);
  const retention = resolveEvidenceRetention(metadata);
  const cleanup = resolveEvidenceCleanup(metadata);
  const state = evidenceRetentionState(metadata);
  if (retention.legalHold) throw new Error("Evidence under legal hold cannot be deleted.");
  if (cleanup.status !== "deletion_requested") throw new Error("Evidence does not have a pending deletion request.");
  if (cleanup.deletionRequestedByUserId === input.actorUserId) {
    throw new Error("Deletion approval requires a different operator from the requester.");
  }

  metadata.cleanup = {
    ...cleanup,
    status: input.approve ? "deletion_approved" : "quarantined",
    deletionApprovedByUserId: input.actorUserId,
    deletionApprovedAt: new Date().toISOString(),
    deletionApprovalNote: note
  };
  await writeEvidenceMetadata(metadata);

  return { metadata, retention, cleanup: metadata.cleanup, state };
}

export async function permanentlyDeleteEvidenceFile(input: {
  fileName: string;
  actorUserId: string;
  confirmation: string;
  note: string;
}) {
  const safeName = path.basename(input.fileName);
  if (safeName !== input.fileName || !evidenceFileNamePattern.test(safeName)) {
    throw new Error("Only hardened evidence files can be permanently deleted.");
  }

  if (input.confirmation.trim() !== evidenceCleanupPolicy.deletionConfirmationPhrase) {
    throw new Error(`Type ${evidenceCleanupPolicy.deletionConfirmationPhrase} to permanently delete evidence media.`);
  }

  const note = input.note.trim();
  if (note.length < 12) {
    throw new Error("Permanent deletion note must explain the final deletion reason.");
  }

  const metadata = await readEvidenceMetadata(safeName);
  const retention = resolveEvidenceRetention(metadata);
  const cleanup = resolveEvidenceCleanup(metadata);
  const state = evidenceRetentionState(metadata);
  if (retention.legalHold) throw new Error("Evidence under legal hold cannot be deleted.");
  if (cleanup.status !== "deletion_approved") throw new Error("Evidence deletion must be approved before execution.");
  if (cleanup.deletionApprovedByUserId === input.actorUserId || cleanup.deletionRequestedByUserId === input.actorUserId) {
    throw new Error("Final deletion requires a third operator after request and approval.");
  }

  const deleted = await evidenceStorageProvider().deleteFile(safeName);
  metadata.cleanup = {
    ...cleanup,
    status: "deleted",
    note,
    deletedByUserId: input.actorUserId,
    deletedAt: new Date().toISOString(),
    deletedObjectKey: deleted.deletedObjectKey
  };
  await writeEvidenceMetadata(metadata);

  return { metadata, retention, cleanup: metadata.cleanup, state };
}

export async function setEvidenceLegalHold(input: {
  fileName: string;
  enabled: boolean;
  actorUserId: string;
  reason: string;
}) {
  const safeName = path.basename(input.fileName);
  if (safeName !== input.fileName || !evidenceFileNamePattern.test(safeName)) {
    throw new Error("Legal hold can only be changed for hardened evidence files.");
  }

  const reason = input.reason.trim();
  if (input.enabled && reason.length < 8) {
    throw new Error("Legal hold reason must explain the investigation or dispute.");
  }

  const metadata = await readEvidenceMetadata(safeName);
  const retention = resolveEvidenceRetention(metadata);
  const now = new Date().toISOString();
  metadata.retention = {
    ...retention,
    legalHold: input.enabled,
    legalHoldReason: input.enabled ? reason : retention.legalHoldReason,
    legalHoldByUserId: input.enabled ? input.actorUserId : retention.legalHoldByUserId,
    legalHoldAt: input.enabled ? now : retention.legalHoldAt,
    legalHoldReleasedByUserId: input.enabled ? retention.legalHoldReleasedByUserId : input.actorUserId,
    legalHoldReleasedAt: input.enabled ? retention.legalHoldReleasedAt : now
  };

  await writeEvidenceMetadata(metadata);
  return {
    metadata,
    retention: metadata.retention,
    state: evidenceRetentionState(metadata)
  };
}

export async function createEvidenceExportManifest(input: {
  fileName: string;
  exportedByUserId: string;
  auditEvents: unknown[];
}) {
  const safeName = path.basename(input.fileName);
  if (safeName !== input.fileName || !evidenceFileNamePattern.test(safeName)) {
    throw new Error("Evidence export can only be created for hardened evidence files.");
  }

  const [metadata, file, fileStat] = await Promise.all([
    readEvidenceMetadata(safeName),
    readEvidenceFile(safeName),
    statEvidenceFile(safeName)
  ]);
  const retention = resolveEvidenceRetention(metadata);
  const state = evidenceRetentionState(metadata);
  const computedSha256 = createHash("sha256").update(file).digest("hex");

  return {
    packageVersion: 1,
    packageType: "skill_rooms_evidence_export",
    generatedAt: new Date().toISOString(),
    exportedByUserId: input.exportedByUserId,
    evidenceUrl: `/api/evidence-files/${safeName}`,
    file: {
      fileName: safeName,
      byteSize: fileStat.byteSize,
      diskByteSizeMatchesMetadata: fileStat.byteSize === metadata.byteSize,
      sha256: metadata.sha256,
      computedSha256,
      sha256MatchesMetadata: computedSha256 === metadata.sha256,
      mimeType: metadata.mimeType,
      evidenceType: metadata.evidenceType,
      createdAt: metadata.createdAt
    },
    context: {
      contextType: metadata.contextType,
      contextId: metadata.contextId,
      uploadedByUserId: metadata.uploadedByUserId
    },
    storage: metadata.storage ?? buildEvidenceStorageMetadata(safeName),
    retention: {
      ...retention,
      state
    },
    cleanup: resolveEvidenceCleanup(metadata),
    auditEvents: input.auditEvents
  };
}

type EvidenceAuditEventLike = {
  event?: string;
  severity?: string;
  actor_user_id?: string | null;
  created_at?: string;
  metadata?: Record<string, unknown>;
};

function sortedAuditEvents(events: unknown[]) {
  return events
    .filter((event): event is EvidenceAuditEventLike => typeof event === "object" && event !== null)
    .sort((left, right) => {
      const leftTime = typeof left.created_at === "string" ? new Date(left.created_at).getTime() : 0;
      const rightTime = typeof right.created_at === "string" ? new Date(right.created_at).getTime() : 0;
      return leftTime - rightTime;
    });
}

export async function createEvidenceChainOfCustodyReview(input: {
  fileName: string;
  reviewedByUserId: string;
  auditEvents: unknown[];
}) {
  const manifest = await createEvidenceExportManifest({
    fileName: input.fileName,
    exportedByUserId: input.reviewedByUserId,
    auditEvents: input.auditEvents
  });
  const events = sortedAuditEvents(input.auditEvents);
  const eventNames = events.map((event) => event.event).filter(Boolean);
  const warningEvents = events.filter((event) => event.severity === "warning");
  const mismatchEvents = eventNames.filter((eventName) =>
    ["evidence.access.metadata_mismatch", "evidence.access.retention_expired", "evidence.access.invalid_request"].includes(
      eventName ?? ""
    )
  );
  const deniedEvents = eventNames.filter((eventName) => eventName === "evidence.access.denied");
  const legalHoldEvents = eventNames.filter((eventName) =>
    eventName === "evidence.access.legal_hold_applied" || eventName === "evidence.access.legal_hold_released"
  );
  const exportEvents = eventNames.filter((eventName) => eventName === "evidence.access.exported");
  const chainEvents = eventNames.filter((eventName) => eventName === "evidence.access.chain_reviewed");

  const findings = [
    manifest.file.diskByteSizeMatchesMetadata
      ? { severity: "info", code: "BYTE_SIZE_MATCH", message: "Disk byte size matches sidecar metadata." }
      : { severity: "critical", code: "BYTE_SIZE_MISMATCH", message: "Disk byte size does not match sidecar metadata." },
    manifest.file.sha256MatchesMetadata
      ? { severity: "info", code: "SHA256_MATCH", message: "Recomputed SHA-256 matches sidecar metadata." }
      : { severity: "critical", code: "SHA256_MISMATCH", message: "Recomputed SHA-256 does not match sidecar metadata." },
    manifest.retention.state === "expired"
      ? { severity: "warning", code: "RETENTION_EXPIRED", message: "Evidence retention has expired unless legal hold applies." }
      : { severity: "info", code: "RETENTION_ACTIVE", message: `Evidence retention state is ${manifest.retention.state}.` },
    manifest.retention.legalHold
      ? { severity: "info", code: "LEGAL_HOLD_ACTIVE", message: "Evidence is under legal hold." }
      : { severity: "info", code: "LEGAL_HOLD_INACTIVE", message: "Evidence is not under legal hold." },
    deniedEvents.length
      ? { severity: "warning", code: "ACCESS_DENIALS_PRESENT", message: `${deniedEvents.length} denied access event(s) are present.` }
      : { severity: "info", code: "NO_ACCESS_DENIALS", message: "No denied access events are present in the loaded audit window." },
    mismatchEvents.length
      ? { severity: "critical", code: "CUSTODY_EXCEPTION_PRESENT", message: `${mismatchEvents.length} custody exception event(s) are present.` }
      : { severity: "info", code: "NO_CUSTODY_EXCEPTIONS", message: "No metadata mismatch, expired-retention access, or invalid-request event is present in the loaded audit window." },
    exportEvents.length
      ? { severity: "info", code: "EXPORT_RECORDED", message: `${exportEvents.length} export event(s) are present.` }
      : { severity: "warning", code: "NO_PRIOR_EXPORT_RECORDED", message: "No prior export event is present in the loaded audit window." },
    legalHoldEvents.length
      ? { severity: "info", code: "LEGAL_HOLD_HISTORY_PRESENT", message: `${legalHoldEvents.length} legal-hold event(s) are present.` }
      : { severity: "info", code: "NO_LEGAL_HOLD_HISTORY", message: "No legal-hold mutation event is present in the loaded audit window." }
  ];

  const verdict = findings.some((finding) => finding.severity === "critical")
    ? "exception"
    : findings.some((finding) => finding.severity === "warning")
      ? "review_required"
      : "clean";

  return {
    reviewVersion: 1,
    reviewType: "skill_rooms_evidence_chain_of_custody",
    generatedAt: new Date().toISOString(),
    reviewedByUserId: input.reviewedByUserId,
    verdict,
    manifest: {
      packageType: manifest.packageType,
      generatedAt: manifest.generatedAt,
      evidenceUrl: manifest.evidenceUrl,
      file: manifest.file,
      context: manifest.context,
      storage: manifest.storage,
      retention: manifest.retention,
      cleanup: manifest.cleanup
    },
    custodySummary: {
      auditEventCount: events.length,
      warningEventCount: warningEvents.length,
      deniedEventCount: deniedEvents.length,
      custodyExceptionCount: mismatchEvents.length,
      legalHoldEventCount: legalHoldEvents.length,
      exportEventCount: exportEvents.length,
      priorChainReviewCount: chainEvents.length,
      firstAuditEventAt: events[0]?.created_at ?? null,
      lastAuditEventAt: events.at(-1)?.created_at ?? null
    },
    findings,
    timeline: events.map((event) => ({
      event: event.event ?? "unknown",
      severity: event.severity ?? "info",
      actorUserId: event.actor_user_id ?? null,
      createdAt: event.created_at ?? null,
      reason: typeof event.metadata?.reason === "string" ? event.metadata.reason : null,
      statusCode: typeof event.metadata?.status_code === "number" ? event.metadata.status_code : null,
      retentionState: typeof event.metadata?.retention_state === "string" ? event.metadata.retention_state : null,
      legalHold: typeof event.metadata?.legal_hold === "boolean" ? event.metadata.legal_hold : null
    }))
  };
}

export async function storeEvidenceFile(input: {
  file: File;
  matchRoomId: string;
  userId: string;
  contextType?: "match_room" | "tournament";
}) {
  if (!input.file.size) return null;

  const rule = allowedTypes.get(input.file.type);
  if (!rule) {
    throw new Error("Upload a PNG, JPG, WEBP, MP4, WEBM, or MOV evidence file.");
  }

  if (input.file.size > rule.maxBytes) {
    const limitMb = Math.floor(rule.maxBytes / (1024 * 1024));
    throw new Error(`Evidence file is too large. Maximum allowed size is ${limitMb}MB.`);
  }

  const bytes = Buffer.from(await input.file.arrayBuffer());
  if (!rule.matches(bytes)) {
    throw new Error("Evidence file content does not match the selected file type.");
  }

  const fileName = [
    "evidence-v1",
    safeSegment(input.matchRoomId),
    safeSegment(input.userId),
    randomUUID()
  ].join("_") + `.${rule.extension}`;

  const createdAt = new Date();
  await evidenceStorageProvider().writeFile(fileName, bytes, { exclusive: true });
  const metadata: StoredEvidenceMetadata = {
    version: 1,
    fileName,
    contextId: input.matchRoomId,
    contextType: input.contextType ?? "match_room",
    uploadedByUserId: input.userId,
    mimeType: input.file.type,
    evidenceType: rule.evidenceType,
    byteSize: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    createdAt: createdAt.toISOString(),
    retention: buildEvidenceRetention({
      contextType: input.contextType ?? "match_room",
      createdAt
    }),
    cleanup: {
      policyId: evidenceCleanupPolicy.policyId,
      status: "active"
    },
    storage: buildEvidenceStorageMetadata(fileName)
  };
  await evidenceStorageProvider().writeMetadata(fileName, metadata, { exclusive: true });

  return {
    evidenceType: rule.evidenceType,
    fileName,
    url: `/api/evidence-files/${fileName}`
  };
}
