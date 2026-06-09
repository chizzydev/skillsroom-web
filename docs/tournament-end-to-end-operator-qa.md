# Tournament End-To-End Operator QA

Last updated: 2026-06-01

Phase T42 adds the web-owned operator QA gate for closed-beta tournament readiness. This is not a new feature phase; it is the executable and manual pass operators should use before a real tournament is allowed to run.

## Automated Gate

Run from `C:\Users\HP\skill-rooms-web`:

```bash
npm run tournament:operator-qa
```

The gate is non-mutating. It verifies:

- public tournament board route
- public tournament detail route and player actions
- admin tournament command center route and actions
- linked match workspace route
- funding, result, settlement, risk/evidence, and notification routes
- API bridge functions for creation, registration, check-in, contribution review, seeding, structure generation, match-room linking, cumulative scoring, result review, settlement, refunds, and host controls
- Risk Ops evidence legal hold, quarantine, deletion, export, and custody controls
- evidence provider migration readiness

Expected public-launch verdict:

- `ready`
- critical findings must be `0`
- failed checks must be `0`

Localhost development may still report `ready_with_warnings` when evidence migration readiness is intentionally evaluating the `local` provider.

## Manual Operator Walkthrough

Use a real operator account in the web app and complete this pass in order:

1. Open `/admin/tournaments` and confirm the command center loads without runtime errors.
2. Create or select a QA tournament with clear game, ruleset, format, entry mode, prize mode, schedule, and commission.
3. Publish the tournament and open registration.
4. Open `/tournaments` and confirm the event appears on the public board.
5. Open `/tournaments/[tournamentId]` and confirm public copy, rules, prize pool, schedule, slots, roster, standings, bracket map, and history are readable.
6. Register at least two eligible entrants, or use prepared QA entrants.
7. Submit contribution proof for paid, sponsored, or hybrid flows and review it from admin.
8. Lock registration, run check-in, and verify checked-in entrants are visible.
9. Seed the tournament using the intended mode.
10. Generate the tournament structure and confirm stages, rounds, match sides, byes, tables, or heats match the selected format.
11. Link eligible head-to-head tournament matches to Skill Rooms match rooms.
12. Open a linked `/matches/[matchId]` page and confirm tournament context, opponent data, match check-in, evidence, and result actions are visible.
13. Review at least one result decision path: score confirmation, dispute, void, forfeit, no-show, or DQ.
14. Confirm standings, placements, tie-breakers, and prize eligibility update after approved results.
15. Reserve tournament settlement or refunds only after unresolved disputes and money exposure are cleared.
16. Open `/notifications` and confirm player-facing tournament events are present.
17. Open `/admin/risk` and confirm evidence audit, legal hold, export, custody, cleanup/quarantine, and deletion controls are available.
18. Repeat the core public board, detail, admin command center, match workspace, and Risk Ops screens on a narrow/mobile viewport.

## Exit Criteria

T42 passes only when:

- `npm run tournament:operator-qa` has zero failed checks
- API operator QA also passes
- public tournament board loads live data
- tournament detail loads live data
- admin tournament command center loads live data
- linked match workspace loads tournament context
- evidence operations remain access-controlled and audited
- manual money reconciliation is still explicit
- mobile/narrow screens have no accidental full-page horizontal overflow
- any defects are written down before the next launch-readiness phase

## Related Docs

- `C:\Users\HP\skill-rooms-web\docs\tournament-admin-closed-beta-guide.md`
- `C:\Users\HP\skill-rooms-api\docs\tournament-closed-beta-runbook.md`
- `C:\Users\HP\skill-rooms-web\docs\tournament-closed-beta-launch-checklist.md`
