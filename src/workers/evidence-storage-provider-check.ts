import { listEvidenceRetentionReport } from "../lib/evidence-storage";
import { evidenceStorageProviderStatus } from "../lib/evidence-storage-provider";

async function main() {
  const report = await listEvidenceRetentionReport();
  const status = evidenceStorageProviderStatus();

  console.log(
    JSON.stringify(
      {
        ok: report.summary.metadataError === 0,
        generatedAt: report.generatedAt,
        storage: status,
        retentionSummary: report.summary
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
