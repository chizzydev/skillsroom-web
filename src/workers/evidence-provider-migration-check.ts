import { createEvidenceProviderMigrationReadinessReport } from "../lib/evidence-provider-migration";

async function main() {
  const report = await createEvidenceProviderMigrationReadinessReport();
  console.log(JSON.stringify(report, null, 2));

  if (report.verdict === "blocked") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
