import { access, readFile } from "node:fs/promises";
import path from "node:path";

type CheckStatus = "pass" | "warn" | "fail";

type LaunchCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  files?: string[];
};

async function pathExists(relativePath: string) {
  try {
    await access(path.join(process.cwd(), relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readProjectFile(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

async function fileCheck(id: string, label: string, files: string[]): Promise<LaunchCheck> {
  const missing = [];
  for (const file of files) {
    if (!(await pathExists(file))) missing.push(file);
  }

  return {
    id,
    label,
    status: missing.length ? "fail" : "pass",
    detail: missing.length ? `Missing launch files: ${missing.join(", ")}` : "Launch files are present.",
    files
  };
}

async function packageScriptCheck(requiredScripts: string[]): Promise<LaunchCheck> {
  const packageJson = JSON.parse(await readProjectFile("package.json")) as { scripts?: Record<string, string> };
  const missing = requiredScripts.filter((script) => !packageJson.scripts?.[script]);

  return {
    id: "launch_scripts",
    label: "Launch verification scripts",
    status: missing.length ? "fail" : "pass",
    detail: missing.length ? `Missing scripts: ${missing.join(", ")}` : "All launch verification scripts are registered.",
    files: ["package.json"]
  };
}

async function docContentCheck(id: string, label: string, file: string, requiredPhrases: string[]): Promise<LaunchCheck> {
  let source = "";
  try {
    source = await readProjectFile(file);
  } catch {
    return {
      id,
      label,
      status: "fail",
      detail: `Missing document: ${file}`,
      files: [file]
    };
  }

  const missing = requiredPhrases.filter((phrase) => !source.includes(phrase));

  return {
    id,
    label,
    status: missing.length ? "fail" : "pass",
    detail: missing.length ? `Missing launch checklist coverage: ${missing.join(", ")}` : "Required launch checklist coverage is documented.",
    files: [file]
  };
}

async function main() {
  const checks = await Promise.all([
    packageScriptCheck([
      "typecheck",
      "lint",
      "test",
      "build",
      "launch:check",
      "tournament:operator-qa",
      "tournament:launch-checklist",
      "evidence:retention:check",
      "evidence:storage:check",
      "evidence:cleanup:check",
      "evidence:deletion:check",
      "evidence:migration:check"
    ]),
    fileCheck("launch_docs", "Closed-beta launch documents", [
      "docs/tournament-closed-beta-launch-checklist.md",
      "docs/tournament-end-to-end-operator-qa.md",
      "docs/tournament-admin-closed-beta-guide.md",
      "docs/evidence-retention-policy.md"
    ]),
    docContentCheck("launch_signoffs", "Launch sign-off coverage", "docs/tournament-closed-beta-launch-checklist.md", [
      "Product/Ops sign-off",
      "Risk/Evidence sign-off",
      "Money/Reconciliation sign-off",
      "Technical sign-off",
      "Go/No-Go Decision"
    ]),
    docContentCheck("launch_routes", "Launch route coverage", "docs/tournament-closed-beta-launch-checklist.md", [
      "/tournaments",
      "/tournaments/[tournamentId]",
      "/admin/tournaments",
      "/admin/risk",
      "/matches/[matchId]",
      "/notifications"
    ]),
    docContentCheck("launch_evidence", "Evidence launch coverage", "docs/tournament-closed-beta-launch-checklist.md", [
      "external evidence storage provider is active",
      "legal hold",
      "chain-of-custody",
      "provider migration"
    ]),
    docContentCheck("launch_money", "Manual money launch coverage", "docs/tournament-closed-beta-launch-checklist.md", [
      "External payment automation remains disabled",
      "manual reconciliation",
      "payout/refund"
    ])
  ]);

  const allChecks = [...checks];
  const summary = allChecks.reduce(
    (totals, check) => {
      totals[check.status] += 1;
      return totals;
    },
    { pass: 0, warn: 0, fail: 0 } as Record<CheckStatus, number>
  );

  const report = {
    phase: "T43",
    name: "Closed Beta Tournament Launch Checklist",
    generated_at: new Date().toISOString(),
    verdict: summary.fail > 0 ? "blocked" : summary.warn > 0 ? "ready_with_warnings" : "ready",
    summary,
    checks: allChecks
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (summary.fail > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
