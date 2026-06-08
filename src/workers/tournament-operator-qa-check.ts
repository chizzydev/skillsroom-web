import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { createEvidenceProviderMigrationReadinessReport } from "../lib/evidence-provider-migration";

type CheckStatus = "pass" | "warn" | "fail";

type OperatorQaCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  routes?: string[];
  files?: string[];
};

type WorkflowProbe = {
  id: string;
  label: string;
  sourceFile: string;
  symbols: string[];
};

async function pathExists(relativePath: string) {
  try {
    await access(path.join(process.cwd(), relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readSource(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

async function routeCheck(id: string, label: string, routes: string[], files: string[]): Promise<OperatorQaCheck> {
  const missing = [];
  for (const file of files) {
    if (!(await pathExists(file))) missing.push(file);
  }

  return {
    id,
    label,
    status: missing.length ? "fail" : "pass",
    detail: missing.length ? `Missing route/action files: ${missing.join(", ")}` : "Route files are present.",
    routes,
    files
  };
}

async function workflowCheck(probe: WorkflowProbe): Promise<OperatorQaCheck> {
  let source = "";
  try {
    source = await readSource(probe.sourceFile);
  } catch {
    return {
      id: probe.id,
      label: probe.label,
      status: "fail",
      detail: `Missing workflow source: ${probe.sourceFile}`,
      files: [probe.sourceFile]
    };
  }

  const missing = probe.symbols.filter((symbol) => !source.includes(symbol));

  return {
    id: probe.id,
    label: probe.label,
    status: missing.length ? "fail" : "pass",
    detail: missing.length ? `Missing workflow symbols: ${missing.join(", ")}` : "Expected workflow hooks are wired.",
    files: [probe.sourceFile]
  };
}

async function main() {
  const routeChecks = await Promise.all([
    routeCheck("public_board", "Public tournament board", ["/tournaments"], ["src/app/tournaments/page.tsx"]),
    routeCheck(
      "public_detail",
      "Public tournament detail and player actions",
      ["/tournaments/[tournamentId]"],
      ["src/app/tournaments/[tournamentId]/page.tsx", "src/app/tournaments/[tournamentId]/actions.ts"]
    ),
    routeCheck(
      "admin_command_center",
      "Admin tournament command center",
      ["/admin/tournaments"],
      ["src/app/admin/tournaments/page.tsx", "src/app/admin/tournaments/actions.ts"]
    ),
    routeCheck("match_workspace", "Linked match workspace", ["/matches/[matchId]"], ["src/app/matches/[matchId]/page.tsx"]),
    routeCheck("funding_ops", "Funding ops queue", ["/admin/funding"], ["src/app/admin/funding/page.tsx"]),
    routeCheck("result_ops", "Result ops queue", ["/admin/results"], ["src/app/admin/results/page.tsx"]),
    routeCheck("settlement_ops", "Settlement ops queue", ["/admin/settlements"], ["src/app/admin/settlements/page.tsx"]),
    routeCheck(
      "risk_evidence_ops",
      "Risk and evidence ops",
      ["/admin/risk"],
      ["src/app/admin/risk/page.tsx", "src/app/admin/risk/actions.ts"]
    ),
    routeCheck("notifications", "Tournament notification inbox", ["/notifications"], ["src/app/notifications/page.tsx"])
  ]);

  const workflowChecks = await Promise.all([
    workflowCheck({
      id: "api_contract",
      label: "Tournament API bridge contract",
      sourceFile: "src/lib/match-room-api.ts",
      symbols: [
        "listTournaments",
        "getTournamentDetail",
        "createTournament",
        "registerForTournament",
        "checkInForTournament",
        "submitTournamentContribution",
        "reviewTournamentContribution",
        "seedTournament",
        "generateTournamentStructure",
        "linkTournamentMatchRooms",
        "applyTournamentCumulativeScores",
        "reviewTournamentMatchResult",
        "reserveTournamentSettlement",
        "reserveTournamentRefunds",
        "grantTournamentHost",
        "updateTournamentHostEvent"
      ]
    }),
    workflowCheck({
      id: "admin_actions",
      label: "Admin operator actions",
      sourceFile: "src/app/admin/tournaments/actions.ts",
      symbols: [
        "createTournamentAction",
        "reviewTournamentContributionAction",
        "seedTournamentAction",
        "generateTournamentStructureAction",
        "linkTournamentMatchRoomsAction",
        "applyTournamentCumulativeScoresAction",
        "reviewTournamentMatchResultAction",
        "reserveTournamentSettlementAction",
        "reserveTournamentRefundsAction",
        "grantTournamentHostAction",
        "updateTournamentHostEventAction"
      ]
    }),
    workflowCheck({
      id: "player_actions",
      label: "Player registration, check-in, and proof actions",
      sourceFile: "src/app/tournaments/[tournamentId]/actions.ts",
      symbols: ["registerForTournamentAction", "checkInForTournamentAction", "submitTournamentContributionAction", "storeEvidenceFile"]
    }),
    workflowCheck({
      id: "match_workspace_actions",
      label: "Tournament match workspace actions",
      sourceFile: "src/lib/match-room-api.ts",
      symbols: ["checkInTournamentMatchRoom", "submitResultClaim", "respondToResultClaim", "getMatchRoomTimeline"]
    }),
    workflowCheck({
      id: "evidence_ops_actions",
      label: "Evidence admin operations",
      sourceFile: "src/app/admin/risk/actions.ts",
      symbols: [
        "updateEvidenceLegalHoldAction",
        "updateEvidenceQuarantineAction",
        "updateEvidenceDeletionAction"
      ]
    }),
    workflowCheck({
      id: "evidence_ops_page",
      label: "Evidence review, export, and custody page controls",
      sourceFile: "src/app/admin/risk/page.tsx",
      symbols: ["/api/evidence-export", "/api/evidence-chain", "updateEvidenceLegalHoldAction", "updateEvidenceQuarantineAction", "updateEvidenceDeletionAction"]
    })
  ]);

  const evidenceReadiness = await createEvidenceProviderMigrationReadinessReport();
  const evidenceCheck: OperatorQaCheck = {
    id: "evidence_readiness",
    label: "Evidence provider readiness",
    status: evidenceReadiness.verdict === "blocked" ? "fail" : evidenceReadiness.verdict === "ready" ? "pass" : "warn",
    detail: `Evidence migration readiness verdict: ${evidenceReadiness.verdict}. Critical findings: ${
      evidenceReadiness.summary.criticalFindings
    }.`,
    files: ["src/lib/evidence-provider-migration.ts"]
  };

  const checks = [...routeChecks, ...workflowChecks, evidenceCheck];
  const summary = checks.reduce(
    (totals, check) => {
      totals[check.status] += 1;
      return totals;
    },
    { pass: 0, warn: 0, fail: 0 } as Record<CheckStatus, number>
  );

  const report = {
    phase: "T42",
    name: "Tournament End-to-End Operator QA",
    generated_at: new Date().toISOString(),
    verdict: summary.fail > 0 ? "blocked" : summary.warn > 0 ? "ready_with_warnings" : "ready",
    summary,
    checks
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
