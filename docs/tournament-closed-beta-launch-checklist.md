# Closed Beta Tournament Launch Checklist

Last updated: 2026-06-01

Phase T43 is the launch packet for running a real Skill Rooms tournament in closed beta. It assumes T42 operator QA has passed and focuses on the final go/no-go decision before registration opens.

## Automated Checks

Run from `C:\Users\HP\skill-rooms-web`:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
npm run tournament:operator-qa
npm run tournament:launch-checklist
npm run evidence:retention:check
npm run evidence:storage:check
npm run evidence:cleanup:check
npm run evidence:deletion:check
npm run evidence:migration:check
```

Closed beta may launch only when the checklist returns `ready`, failed checks are `0`, and the public deployment is backed by an external evidence storage provider.

## Product/Ops Sign-Off

Confirm:

- event owner is named
- support owner is named
- public tournament title, description, rules, format, schedule, entry rules, prize copy, and sponsor copy are final
- `/tournaments` shows the tournament correctly
- `/tournaments/[tournamentId]` shows rules, schedule, roster, standings, bracket map, prize pool, and audit state without preview data
- `/admin/tournaments` loads the event for operators
- linked `/matches/[matchId]` workspaces show tournament context and opponent data
- `/notifications` shows tournament updates for tested player flows

## Risk/Evidence Sign-Off

Confirm:

- `/admin/risk` loads evidence audit activity
- hardened evidence upload is used for new tournament proof
- evidence access remains context-aware
- legal hold controls are available
- export package controls are available
- chain-of-custody review controls are available
- cleanup/quarantine controls are available
- permanent deletion approval controls are available
- provider migration readiness has zero critical findings

## Money/Reconciliation Sign-Off

External payment automation remains disabled for closed beta.

Confirm:

- fee mode is correct: free, paid, sponsored, or hybrid
- sponsor/platform contribution amounts match external promises
- entry fee amount and currency are correct
- commission basis points are correct
- prize distribution is correct
- contribution proofs are not approved from screenshot alone
- manual reconciliation owner is named
- payout/refund reservation is blocked until disputes and money exposure are resolved

## Technical Sign-Off

Confirm:

- API launch checks have passed
- web launch checks have passed
- tournament operator QA has zero failed checks
- browser QA covers `/tournaments`, `/tournaments/[tournamentId]`, `/admin/tournaments`, `/admin/risk`, `/matches/[matchId]`, and `/notifications`
- mobile/narrow viewport has no accidental full-page horizontal overflow
- no runtime errors appear on launch-critical pages

## Go/No-Go Decision

Go only when:

- Product/Ops sign-off is complete
- Risk/Evidence sign-off is complete
- Money/Reconciliation sign-off is complete
- Technical sign-off is complete
- operator owner and support owner are both assigned
- known closed-beta warnings are accepted explicitly

No-go when:

- any automated check fails
- admin access is broken
- public tournament pages show runtime errors
- unresolved disputes exist
- proof review is ambiguous
- payout/refund totals do not match prize/refund allocation
- evidence readiness has critical findings
- no operator or support owner is assigned

## Launch-Day Watch

For the first real closed-beta tournament, keep an operator watching:

- registration queue
- contribution review
- check-in progress
- generated structure
- match-room linkage
- result review
- evidence audit
- notifications
- settlement/refund queue

Any severe incident should stop advancement until the operator records the decision path and risk/evidence state.

## Live Dry Run

Before a real player-facing closed-beta tournament, complete:

- `C:\Users\HP\skill-rooms-web\docs\tournament-live-closed-beta-dry-run.md`

Run:

```bash
npm run tournament:dry-run-check
```

The expected automated verdict is `ready_for_manual_rehearsal` until the authenticated browser rehearsal transcript is completed.
