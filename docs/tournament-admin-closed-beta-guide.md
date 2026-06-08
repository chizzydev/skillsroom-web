# Tournament Admin Closed Beta Guide

Last updated: 2026-06-01

This guide maps the tournament closed-beta runbook to the web admin screens operators use day to day.

Primary admin route:

- `/admin/tournaments`

Primary player routes:

- `/tournaments`
- `/tournaments/[tournamentId]`
- linked `/matches/[matchId]` pages for tournament match rooms

## Admin Workflow

### 1. Create Tournament

Use the Tournament Creation panel.

Check:

- title and description
- game and ruleset
- format and scoring mode
- entry type and team size
- fee mode and entry fee
- sponsor/platform prize pool fields
- commission
- min/max entries
- registration and start times

Do not publish until the event copy and money rules are final.

### 2. Publish And Open Registration

Use lifecycle controls to move from draft to published, then registration open.

Check:

- public board shows only real published/active tournaments
- detail page shows current status, entry limits, schedule, prize pool, and rules
- tournament appears in admin operations

### 3. Monitor Entrants

Use the command center and detail entrant tables.

Check:

- entrants count
- waitlist count
- check-in count
- funding status
- seed readiness
- suspicious duplicate names, handles, or payment patterns

### 4. Review Funding

Use the tournament funding/contribution controls and admin funding queue.

Rules:

- proof alone is not enough
- confirm external bank/app record before approval
- reject unclear, duplicate, mismatched, underpaid, or overpaid proof
- paid/hybrid entries must be funded before check-in

### 5. Lock Registration And Check In

Once registration closes:

- confirm entrant count
- confirm funding approval where required
- ask players to check in
- keep questionable entries out of seeding until reviewed

### 6. Seed Tournament

Use the Seeding Engine panel.

Modes:

- registration order
- random
- reputation
- manual

Manual mode must contain every eligible checked-in or already-seeded entry exactly once.

### 7. Generate Structure

Use the structure generator after seeding.

Verify:

- stages are present
- rounds are present
- match sides are populated
- byes are intentional
- standings exist
- public detail page shows generated structure

### 8. Link Match Rooms

Use match-room linkage for eligible generated head-to-head matches.

Verify:

- linked rooms appear in admin command center
- tournament context appears on match detail pages
- players can see opponent, match state, evidence/result actions, and tournament metadata

### 9. Review Results

Use result review controls for:

- score confirmation
- disputes
- forfeits
- no-shows
- disqualifications
- void matches

Never resolve a disputed tournament match without checking:

- player evidence
- linked match room timeline
- match-side results
- tournament history
- prior risk/moderation actions

### 10. Reserve Settlement Or Refunds

Use settlement/refund controls after results are final.

Before reserving:

- confirm standings
- confirm prize eligibility
- confirm prize allocation rows
- confirm approved contributions
- confirm commission
- confirm no unresolved disputes remain

After reservation:

- complete manual payout/refund only after external transfer
- store external references
- keep reconciliation notes

## Screens Operators Must Recheck

Before any real closed-beta tournament:

- `/tournaments`
- `/tournaments/[tournamentId]`
- `/admin/tournaments`
- `/admin/funding`
- `/admin/results`
- `/admin/settlements`
- `/admin/risk`
- linked `/matches/[matchId]`
- `/notifications`

## End-To-End Operator QA

Run the automated web gate before any real closed-beta tournament:

```bash
npm run tournament:operator-qa
```

Then complete the human walkthrough:

1. Confirm `/admin/tournaments` loads for an operator account.
2. Create or select a QA tournament with final game, format, scoring, funding, schedule, and commission settings.
3. Publish and open registration.
4. Confirm `/tournaments` and `/tournaments/[tournamentId]` show live event data.
5. Register/check in entrants and verify roster state.
6. Submit and review funding proof for paid, sponsored, or hybrid flows.
7. Seed, generate structure, and verify stages, rounds, match sides, byes, tables, heats, or standings for the selected format.
8. Link eligible head-to-head matches into Skill Rooms match rooms.
9. Open a linked `/matches/[matchId]` workspace and verify tournament context, opponent data, match check-in, evidence, and result actions.
10. Review score confirmation, dispute, void, forfeit, no-show, or DQ paths as needed.
11. Confirm standings, placements, tie-breakers, and prize eligibility after approved results.
12. Reserve settlement/refunds only after disputes and money exposure are resolved.
13. Confirm `/notifications` includes tournament updates.
14. Confirm `/admin/risk` evidence audit, legal hold, export, custody, cleanup/quarantine, and deletion controls are available.

## Mobile/Narrow QA Checklist

Run on narrow viewport after tournament UI changes:

- no runtime error
- no accidental full-page horizontal overflow
- bottom navigation does not cover primary action permanently
- admin tab strip remains intentionally scrollable, not broken
- tournament board cards fit
- tournament detail hero, metrics, policy, roster, standings, bracket map, and audit sections are readable
- admin command center cards, tables, and action forms remain usable

## Incident Handling From Web UI

If a tournament incident occurs:

1. Stop advancing tournament state.
2. Use result review to mark dispute/void/forfeit/no-show/DQ when match-specific.
3. Use risk admin tools for user-level moderation.
4. Use room holds when linked match rooms should stop settlement/result action.
5. Use notifications to confirm player-facing updates were created.
6. Use settlement/refund pages only after dispute and money exposure are resolved.

## Current Closed Beta Limits

- External payment confirmation is manual.
- Email/SMS sending is not live; in-app notifications are the active channel.
- Evidence handling is now hardened behind app-hosted upload, context-aware access control, audit trail, retention, legal hold, export, custody review, quarantine, deletion approval, and provider migration readiness. The active closed-beta storage provider is still local.
- Admin step-up still uses the current token workflow.
- Browser screenshot QA must be repeated after major design or route changes.

## Source Of Truth

Operational policy and reconciliation details live in:

- `C:\Users\HP\skill-rooms-api\docs\tournament-closed-beta-runbook.md`
- `C:\Users\HP\skill-rooms-web\docs\tournament-end-to-end-operator-qa.md`
- `C:\Users\HP\skill-rooms-web\docs\tournament-closed-beta-launch-checklist.md`

This web guide explains where operators perform those steps in the UI.
