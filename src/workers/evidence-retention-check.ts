import { listEvidenceRetentionReport } from "../lib/evidence-storage";

async function main() {
  const report = await listEvidenceRetentionReport();
  console.log(JSON.stringify(report, null, 2));

  if (report.summary.expired > 0 || report.summary.metadataError > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
