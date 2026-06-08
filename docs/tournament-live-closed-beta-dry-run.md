# Live Closed Beta Tournament Dry Run

Last updated: 2026-06-01

Phase T44 is the first live-style rehearsal of a Skill Rooms tournament. This phase does not replace the T43 launch checklist; it proves that an operator can walk a real tournament record through the critical browser workflows and write down the outcome.

## Automated Packet Check

Run from `C:\Users\HP\skill-rooms-web`:

```bash
npm run tournament:operator-qa
npm run tournament:launch-checklist
npm run tournament:dry-run-check
```

The dry-run check confirms that this packet exists and has route, lifecycle, transcript, and exit-criteria coverage. It returns `ready_for_manual_rehearsal` until a real operator completes the authenticated browser rehearsal.

## Dry-Run Setup

Use a clearly marked QA tournament:

- title includes `Closed Beta Dry Run`
- fee mode is `free`, or paid/hybrid money is treated as manual test money only
- sponsor/platform prize language is clearly marked as rehearsal-only
- operator owner is named
- support owner is named
- defects are recorded before the dry run is considered complete

## Browser Rehearsal Steps

1. Create or select the dry-run tournament in `/admin/tournaments`.
2. Verify the game, ruleset, format, scoring mode, schedule, entry rules, prize copy, and sponsor copy.
3. Publish the event.
4. Open registration.
5. Open `/tournaments` and confirm the tournament appears on the board.
6. Open `/tournaments/[tournamentId]` and confirm player-facing copy, rules, roster, standings, prize pool, bracket map, and audit state.
7. Register entrants.
8. Submit contribution proof if the rehearsal covers paid, sponsored, or hybrid flow.
9. Review contribution proof from admin.
10. Lock registration.
11. Check in entrants.
12. Seed.
13. Generate structure.
14. Link match rooms.
15. Open a linked `/matches/[matchId]` workspace.
16. Confirm tournament context, opponent data, match check-in, evidence, and result actions.
17. Review result through score confirmation, dispute, void, forfeit, no-show, or DQ path.
18. Confirm standings, placements, tie-breakers, and prize eligibility.
19. Reserve settlement or refunds only if the dry-run money state is intentionally reconciled.
20. Open `/notifications` and confirm tournament updates are visible.
21. Open `/admin/risk` and confirm evidence audit, legal hold, export, chain-of-custody, cleanup/quarantine, and deletion controls are reachable.
22. Repeat launch-critical screens on a narrow/mobile viewport.

## Dry-Run Transcript

Record this for every rehearsal:

- Date/time:
- Operator owner:
- Support owner:
- Tournament ID:
- Tournament title:
- Format:
- Fee mode:
- Entrant count:
- Linked match room IDs:
- Result-review path tested:
- Settlement/refund path tested:
- Evidence file tested:
- Mobile viewport tested:
- Known closed-beta warnings accepted:
- Defects Found:
- Rollback/Stop Notes:
- Decision: `pass`, `pass_with_followups`, or `No-go`

## Defects Found

Each defect must include:

- route
- user role
- expected behavior
- actual behavior
- screenshot or evidence link when available
- severity
- owner
- decision: fix before launch, accept for closed beta, or monitor

## Rollback/Stop Notes

Use these notes when the dry run exposes launch risk:

- stop opening registration if public copy, schedule, or prize copy is wrong
- stop seeding if entrants, funding, or check-in state is wrong
- stop match-room linking if generated structure is wrong
- stop settlement/refunds if disputes, standings, allocations, or manual reconciliation are unclear
- stop evidence review if access control, audit, export, or chain-of-custody behavior is unclear

## Exit Criteria

The dry run passes only when:

- T43 launch checklist still passes
- authenticated operator can complete the browser rehearsal
- `/tournaments`, `/tournaments/[tournamentId]`, `/admin/tournaments`, `/admin/risk`, `/matches/[matchId]`, and `/notifications` load without runtime errors
- mobile/narrow viewport has no accidental full-page horizontal overflow
- result review and settlement/refund gates behave as expected
- evidence controls remain access-controlled and auditable
- known closed-beta warnings are explicitly accepted
- no launch-blocking defects remain

No-go when:

- admin cannot complete the lifecycle
- public pages show runtime errors
- linked match rooms lose tournament context
- proof review or result review is ambiguous
- evidence controls fail
- payout/refund totals cannot be explained
- operator owner or support owner is missing
