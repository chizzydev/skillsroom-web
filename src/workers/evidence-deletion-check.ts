import { listEvidenceRetentionReport } from "../lib/evidence-storage";

async function main() {
  const report = await listEvidenceRetentionReport();
  const pendingRequests = report.entries.filter((entry) => entry.cleanupStatus === "deletion_requested");
  const approved = report.entries.filter((entry) => entry.cleanupStatus === "deletion_approved");
  const deleted = report.entries.filter((entry) => entry.cleanupStatus === "deleted");

  console.log(
    JSON.stringify(
      {
        generatedAt: report.generatedAt,
        storage: report.storage,
        summary: {
          deletionEligible: report.summary.deletionEligible,
          deletionRequested: report.summary.deletionRequested,
          deletionApproved: report.summary.deletionApproved,
          deleted: report.summary.deleted,
          metadataError: report.summary.metadataError
        },
        pendingRequests: pendingRequests.map((entry) => ({
          fileName: entry.fileName,
          contextId: entry.contextId,
          contextType: entry.contextType,
          requestedAt: entry.deletionRequestedAt,
          requestedByUserId: entry.deletionRequestedByUserId
        })),
        approved: approved.map((entry) => ({
          fileName: entry.fileName,
          contextId: entry.contextId,
          contextType: entry.contextType,
          approvedAt: entry.deletionApprovedAt,
          approvedByUserId: entry.deletionApprovedByUserId
        })),
        deleted: deleted.map((entry) => ({
          fileName: entry.fileName,
          deletedAt: entry.deletedAt,
          deletedByUserId: entry.deletedByUserId,
          deletedObjectKey: entry.deletedObjectKey
        }))
      },
      null,
      2
    )
  );

  if (report.summary.metadataError > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
