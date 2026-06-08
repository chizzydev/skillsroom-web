import { access, readFile } from "node:fs/promises";
import path from "node:path";

type CheckStatus = "pass" | "warn" | "fail";

type DryRunCheck = {
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

async function fileCheck(id: string, label: string, files: string[]): Promise<DryRunCheck> {
  const missing = [];
  for (const file of files) {
    if (!(await pathExists(file))) missing.push(file);
  }

  return {
    id,
    label,
    status: missing.length ? "fail" : "pass",
    detail: missing.length ? `Missing dry-run files: ${missing.join(", ")}` : "Dry-run files are present.",
    files
  };
}

async function scriptCheck(requiredScripts: string[]): Promise<DryRunCheck> {
  const packageJson = JSON.parse(await readProjectFile("package.json")) as { scripts?: Record<string, string> };
  const missing = requiredScripts.filter((script) => !packageJson.scripts?.[script]);

  return {
    id: "dry_run_scripts",
    label: "Dry-run verification scripts",
    status: missing.length ? "fail" : "pass",
    detail: missing.length ? `Missing scripts: ${missing.join(", ")}` : "Dry-run verification scripts are registered.",
    files: ["package.json"]
  };
}

async function docCheck(id: string, label: string, file: string, requiredPhrases: string[]): Promise<DryRunCheck> {
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
    detail: missing.length ? `Missing dry-run coverage: ${missing.join(", ")}` : "Required dry-run coverage is documented.",
    files: [file]
  };
}

async function main() {
  const checks = await Promise.all([
    scriptCheck(["tournament:operator-qa", "tournament:launch-checklist", "tournament:dry-run-check"]),
    fileCheck("dry_run_docs", "Live dry-run documents", [
      "docs/tournament-live-closed-beta-dry-run.md",
      "docs/tournament-closed-beta-launch-checklist.md",
      "docs/tournament-end-to-end-operator-qa.md"
    ]),
    docCheck("dry_run_routes", "Dry-run route coverage", "docs/tournament-live-closed-beta-dry-run.md", [
      "/tournaments",
      "/tournaments/[tournamentId]",
      "/admin/tournaments",
      "/admin/risk",
      "/matches/[matchId]",
      "/notifications"
    ]),
    docCheck("dry_run_lifecycle", "Dry-run lifecycle coverage", "docs/tournament-live-closed-beta-dry-run.md", [
      "Create or select the dry-run tournament",
      "Open registration",
      "Register entrants",
      "Check in entrants",
      "Seed",
      "Generate structure",
      "Link match rooms",
      "Review result",
      "Reserve settlement or refunds"
    ]),
    docCheck("dry_run_transcript", "Dry-run transcript template", "docs/tournament-live-closed-beta-dry-run.md", [
      "Dry-Run Transcript",
      "Defects Found",
      "Decision",
      "Rollback/Stop Notes"
    ]),
    docCheck("dry_run_exit", "Dry-run exit criteria", "docs/tournament-live-closed-beta-dry-run.md", [
      "Exit Criteria",
      "No-go",
      "known closed-beta warnings"
    ])
  ]);

  const manualRunWarning: DryRunCheck = {
    id: "manual_browser_rehearsal",
    label: "Manual browser rehearsal required",
    status: "warn",
    detail: "This gate verifies the dry-run packet. Operators must still perform and record the authenticated browser rehearsal."
  };

  const allChecks = [...checks, manualRunWarning];
  const summary = allChecks.reduce(
    (totals, check) => {
      totals[check.status] += 1;
      return totals;
    },
    { pass: 0, warn: 0, fail: 0 } as Record<CheckStatus, number>
  );

  const report = {
    phase: "T44",
    name: "Live Closed Beta Tournament Dry Run",
    generated_at: new Date().toISOString(),
    verdict: summary.fail > 0 ? "blocked" : summary.warn > 0 ? "ready_for_manual_rehearsal" : "ready",
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
