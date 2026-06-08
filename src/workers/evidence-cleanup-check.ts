import { listEvidenceRetentionReport, quarantineEvidenceFile } from "../lib/evidence-storage";

const apply = process.argv.includes("--apply");
const actorUserId = process.env.EVIDENCE_CLEANUP_ACTOR_USER_ID || "system:evidence-cleanup";

async function main() {
  const report = await listEvidenceRetentionReport();
  const candidates = report.entries.filter((entry) => entry.cleanupEligible);
  const quarantined: Array<{ fileName: string; state: string }> = [];
  const failed: Array<{ fileName: string; error: string }> = [];

  if (apply) {
    for (const candidate of candidates) {
      try {
        const result = await quarantineEvidenceFile({
          fileName: candidate.fileName,
          actorUserId,
          reason: "retention_expired",
          note: "Automated retention cleanup quarantine."
        });
        quarantined.push({ fileName: result.metadata.fileName, state: result.state });
      } catch (error) {
        failed.push({
          fileName: candidate.fileName,
          error: error instanceof Error ? error.message : "Unknown cleanup error"
        });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply_quarantine" : "dry_run",
        generatedAt: report.generatedAt,
        storage: report.storage,
        policy: report.policy,
        summary: report.summary,
        candidates: candidates.map((entry) => ({
          fileName: entry.fileName,
          contextId: entry.contextId,
          contextType: entry.contextType,
          retainUntil: entry.retainUntil,
          cleanupReason: entry.cleanupReason
        })),
        quarantined,
        failed
      },
      null,
      2
    )
  );

  if (report.summary.metadataError > 0 || failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
