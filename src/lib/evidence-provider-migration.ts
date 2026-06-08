import { createHash } from "node:crypto";
import {
  evidenceCleanupPolicy,
  evidenceFileNamePattern,
  evidenceRetentionPolicy,
  listEvidenceRetentionReport,
  readEvidenceFile,
  readEvidenceMetadata,
  resolveEvidenceCleanup,
  resolveEvidenceRetention,
  statEvidenceFile,
  type StoredEvidenceMetadata
} from "./evidence-storage";
import { evidenceStorageProviderStatus } from "./evidence-storage-provider";

export const evidenceProviderMigrationReadiness = {
  readinessId: "closed_beta_evidence_provider_migration_v1",
  targetProviders: ["s3_compatible", "cloudflare_r2", "supabase_storage"],
  finalEvidenceInfrastructurePhase: true
} as const;

type MigrationFindingSeverity = "info" | "warning" | "critical";

type MigrationFinding = {
  severity: MigrationFindingSeverity;
  code: string;
  message: string;
  fileName?: string;
};

function storedObjectKey(metadata: StoredEvidenceMetadata) {
  if (metadata.cleanup?.status === "deleted") return metadata.cleanup.deletedObjectKey ?? metadata.storage?.objectKey ?? null;
  if (metadata.cleanup?.status && metadata.cleanup.status !== "active") return metadata.cleanup.quarantineObjectKey ?? metadata.storage?.objectKey ?? null;
  return metadata.storage?.objectKey ?? null;
}

async function inspectPortableFile(fileName: string): Promise<MigrationFinding[]> {
  const findings: MigrationFinding[] = [];
  const metadata = await readEvidenceMetadata(fileName);
  const retention = resolveEvidenceRetention(metadata);
  const cleanup = resolveEvidenceCleanup(metadata);

  if (!evidenceFileNamePattern.test(fileName)) {
    findings.push({
      severity: "critical",
      code: "UNSUPPORTED_FILENAME",
      message: "Only hardened evidence-v1 files are eligible for provider migration.",
      fileName
    });
  }

  if (!metadata.storage?.provider || !metadata.storage.objectKey || !metadata.storage.metadataObjectKey) {
    findings.push({
      severity: "warning",
      code: "MISSING_STORAGE_METADATA",
      message: "Sidecar is missing provider/object metadata; migration can infer local paths but should backfill before provider switch.",
      fileName
    });
  }

  if (!metadata.retention) {
    findings.push({
      severity: "warning",
      code: "MISSING_RETENTION_METADATA",
      message: "Sidecar relies on inferred retention. Backfill explicit retention before migrating providers.",
      fileName
    });
  }

  if (!metadata.cleanup) {
    findings.push({
      severity: "warning",
      code: "MISSING_CLEANUP_METADATA",
      message: "Sidecar relies on inferred cleanup status. Backfill explicit cleanup metadata before migrating providers.",
      fileName
    });
  }

  if (retention.legalHold && cleanup.status === "deleted") {
    findings.push({
      severity: "critical",
      code: "LEGAL_HOLD_DELETED",
      message: "Sidecar indicates deleted media while legal hold is active.",
      fileName
    });
  }

  const objectKey = storedObjectKey(metadata);
  if (!objectKey) {
    findings.push({
      severity: "warning",
      code: "MISSING_OBJECT_KEY",
      message: "No source object key is recorded for this evidence item.",
      fileName
    });
  }

  if (cleanup.status !== "deleted") {
    try {
      const [file, fileStat] = await Promise.all([readEvidenceFile(fileName), statEvidenceFile(fileName)]);
      const computedSha256 = createHash("sha256").update(file).digest("hex");
      if (fileStat.byteSize !== metadata.byteSize) {
        findings.push({
          severity: "critical",
          code: "BYTE_SIZE_MISMATCH",
          message: "Stored media byte size does not match sidecar metadata.",
          fileName
        });
      }
      if (computedSha256 !== metadata.sha256) {
        findings.push({
          severity: "critical",
          code: "SHA256_MISMATCH",
          message: "Stored media SHA-256 does not match sidecar metadata.",
          fileName
        });
      }
    } catch {
      findings.push({
        severity: "critical",
        code: "MEDIA_UNREADABLE",
        message: "Media is not readable from the active provider or quarantine fallback path.",
        fileName
      });
    }
  }

  return findings;
}

export async function createEvidenceProviderMigrationReadinessReport() {
  const retentionReport = await listEvidenceRetentionReport();
  const provider = evidenceStorageProviderStatus();
  const findings: MigrationFinding[] = [
    {
      severity: provider.external ? "info" : "warning",
      code: provider.external ? "EXTERNAL_PROVIDER_ACTIVE" : "LOCAL_PROVIDER_ACTIVE",
      message: provider.external
        ? "Evidence is already using an external provider."
        : "Evidence is still using local storage. Do not switch production traffic until external provider migration is rehearsed."
    },
    {
      severity: "info",
      code: "NO_LIVE_PROVIDER_SWITCH",
      message: "This readiness phase does not enable a new provider. It only validates portability and documents the cutover path."
    }
  ];

  for (const entry of retentionReport.entries) {
    if (entry.state === "metadata_error") {
      findings.push({
        severity: "critical",
        code: "METADATA_UNREADABLE",
        message: "Sidecar cannot be parsed and must be repaired before migration.",
        fileName: entry.fileName
      });
      continue;
    }
    findings.push(...(await inspectPortableFile(entry.fileName)));
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  const verdict = criticalCount ? "blocked" : warningCount ? "ready_with_warnings" : "ready";

  return {
    readiness: evidenceProviderMigrationReadiness,
    generatedAt: new Date().toISOString(),
    verdict,
    provider,
    policies: {
      retention: evidenceRetentionPolicy,
      cleanup: evidenceCleanupPolicy
    },
    summary: {
      evidenceFiles: retentionReport.summary.total,
      metadataErrors: retentionReport.summary.metadataError,
      active: retentionReport.summary.active,
      quarantined: retentionReport.summary.quarantined,
      deleted: retentionReport.summary.deleted,
      criticalFindings: criticalCount,
      warningFindings: warningCount
    },
    parityChecklist: [
      "write media with exclusive create semantics",
      "read active media by hardened file name",
      "read quarantined media for export and custody review",
      "write and read JSON sidecar metadata",
      "list sidecar metadata file names",
      "stat media byte size",
      "move active media to quarantine",
      "restore quarantined media",
      "delete media while preserving sidecar tombstone",
      "preserve SHA-256, byte size, retention, legal-hold, cleanup, and storage metadata"
    ],
    cutoverChecklist: [
      "freeze cleanup/deletion mutations during copy window",
      "export local readiness report",
      "copy active and quarantined media to target provider",
      "copy sidecar metadata to target provider metadata namespace",
      "verify byte size and SHA-256 parity after copy",
      "run readiness report against target provider in staging",
      "switch EVIDENCE_STORAGE_PROVIDER only after staging parity passes",
      "keep local backup until post-cutover audit window closes"
    ],
    findings
  };
}
