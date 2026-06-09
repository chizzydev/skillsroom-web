# Testing Notes

## Phase 0 Tests

- `src/lib/phase0-smoke.test.ts` validates the API base URL shape.

## Required Before Phase Completion

```bash
npm run typecheck
npm run test
npm run launch:check
```

## Future Verification

- Browser screenshots for lobby and admin.
- Mobile viewport checks.
- Text overflow checks.
- Auth guard tests.
- Admin access checks.
- Match room flow smoke tests.

## Phase 3 Verification

Run completed:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
npm run launch:check
npm audit
```

Live HTTP smoke:

- `/` returned 200 after restarting the dev server.
- `/sign-in` returned 200.
- `/admin` returned 307 redirect without a session.

Note: in-app browser tooling was not available in this session, so visual verification was limited to build/static route checks.

## Phase 4 Verification

Run completed:

```bash
npm run typecheck
npm run lint
npm run build
```

Build confirmed dynamic routes:

- `/profile`
- `/admin/players`

## Phase 5 Verification

Run completed:

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Build confirmed dynamic match-room routes:

- `/matches`
- `/matches/new`
- `/matches/[matchId]`

The match pages now use authenticated server actions and API reads. Browser screenshot verification is still pending for the next visual QA pass.

## Phase 6 Verification

Run completed:

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Build confirmed funding route:

- `/admin/funding`

Player room detail now includes funding submission and funding status panels. Admin funding review now uses the authenticated step-up unlock flow instead of manual token entry.

## Phase 7 Verification

Run completed:

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Build confirmed result review route:

- `/admin/results`

Player room detail now includes result claim, evidence link, claims table, and opponent response forms.

## Phase 8 Verification

Run completed:

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Build confirmed settlement route:

- `/admin/settlements`

Admin settlement page now includes payout queue, refund queue, settlement reservation, and manual completion forms.

## Phase 9 Verification

Run completed:

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Build confirmed risk route:

- `/admin/risk`

Admin risk page now includes risk flags, room holds, moderation audit, account moderation, and status update forms.

## Phase 10 Verification

Run completed:

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Build confirmed community routes:

- `/community`
- `/notifications`

Player navigation now includes Community and Notifications.
