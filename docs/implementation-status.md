# Skill Rooms Web Implementation Status

Last updated: 2026-06-09

## Admin Step-Up UX Hardening

- Replaced raw admin `step-up token` inputs across funding, results, settlements, Risk Ops, and tournament operator flows.
- Added a shared admin unlock panel that confirms the current admin password and stores a short-lived step-up grant in an httpOnly cookie.
- Sensitive admin mutations now read the session-bound step-up grant server-side instead of asking operators to copy tokens manually.
- Step-up state is cleared on fresh auth transitions so old unlock state does not leak across login/session changes.
- This closes the previous dead-end operator flow and makes sensitive approvals/rejections production-usable.

## Realtime Product Feel

- Added same-origin realtime proxy route at `/api/community/realtime/stream` so browser sessions can subscribe without exposing access tokens to client-side header logic.
- Added shared `LiveUpdateStream` listener component with reconnect state, visibility-aware deferred refresh, and debounced `router.refresh()` behavior.
- Added typed live toast narration on top of the stream so pages now explain what changed instead of only silently refreshing.
- Toast narration is scoped to real event types across matches, tournaments, moderation queues, settlements, and inbox activity, with hidden-tab catch-up summaries when a player returns.
- Wired live refresh UX into notifications, match workspace, tournament detail, admin command center, and admin funding/results/settlements/risk/tournament lanes.
- Current realtime behavior is durable event driven, not blind polling, and is now attached to actual funding, dispute, settlement, moderation, and tournament lifecycle mutations.

## V3 Recovery Track

The original V1/V2 web implementation reached many backend-connected surfaces, but the product experience is not yet good enough for a serious closed beta. V3 is now the active direction.

| Phase | Name | Status | Notes |
|---|---|---:|---|
| V3-1 | Product UX Rewrite + Design Recovery Plan | Done | Created the V3 recovery blueprint, product standard, screen rebuild targets, copy rules, auth correction, design direction, and execution roadmap. |
| V3-2 | Owned Auth Like Decide | Done | Replaced the visible dev role-picker with real login/register routes, access/refresh cookies, backend logout, refresh route, and sign-out controls. |
| V3-3 | App Shell Rebuild | Done | Rebuilt player/admin shells with role-aware account controls, mobile bottom nav, polished top bars, cleaner ops navigation, and visible sign-out surfaces. |
| V3-4 | Player Lobby V3 | Done | Rebuilt the home lobby with live API room data, mobile-first room cards, join-code flow, real status metrics, trust guidance, and no preview/roadmap copy. |
| V3-5 | Room Detail V3 | Done | Rebuilt room detail into a player match workspace with next action, slots, funding review, result evidence, opponent response, and audit trail. |
| V3-6 | Admin Command Center V3 | Done | Rebuilt admin overview around live queues, upgraded funding/result decision workspaces, tightened settlements/risk empty states, and removed fake player directory rows. |
| V3-7 | Trust + Reputation Layer | Done | Added real profile/trust data, reusable trust cards, room-slot trust summaries, community reputation context, and admin player trust review. |
| V3-8 | Design System Upgrade | Done | Upgraded tokens, shell spacing, core primitives, loading/error states, skeletons, tabs, toast surface, and mobile sheet foundation. |
| V3-9 | Real Data Wiring Cleanup | Done | Removed remaining static visible metrics/actions from real pages, wired community invites and create-room catalog to APIs, and added honest empty states. |
| V3-Auth+ | Username + Google Auth Enhancement | Done | Updated auth screens for username-first registration, email/username login, stable password reveal, confirm password, and Google sign-in. |
| V3-10 | Mobile QA + Responsive Hardening | Done | Hardened mobile tables, metric grids, panel actions, trust cards, bottom navigation spacing, and overflow-prone responsive grids. |
| V3-11 | Closed Beta Readiness Review | Pending | Replace the previous engineering-only launch check framing with a real product readiness gate. |
| T3 | Admin Tournament Creation | Done | Added tournament admin lane, creation form, live tournament queue, and tournament API bridge support. |
| T4 | Public Tournament Listing | Done | Added player-facing tournament board, Tourneys nav, filters, live metrics, event cards, and tournament comparison table. |
| T5 | Tournament Detail Page | Done | Added API-backed tournament detail workspace with overview, registration, prize, stages/matches, and audit sections. |
| T6 | Registration + Roster Engine | Done | Added player registration action, tournament detail registration controls, and real entrant/roster display. |
| T7 | Check-In Engine | Done | Added player check-in action, check-in state messaging, and entrant check-in visibility. |
| T8 | Prize Contribution Workflow | Done | Added contribution submission on tournament detail and admin review queue for tournament money operations. |
| T9 | Seeding Engine | Done | Added admin seeding workflow with registration-order, random, reputation, and manual seed modes. |
| T10 | Stage Generator Core | Done | Added admin structure generation workflow and tournament detail pairing visibility from generated match sides. |
| T11 | Single Elimination Engine | API Done | API now handles byes, single-elim advancement, standings updates, and optional bronze match shells. |
| T12 | Double Elimination Engine | API Done | API now handles winners/losers advancement, loser drops, bye propagation, standings updates, and grand-final reset shells. |
| T13 | Round Robin Engine | Done | Added API-backed standings table rendering for round-robin ranking, points, W/L/D, score diff, and points-for values. |
| T14 | Swiss Engine | API Done | API now handles dynamic Swiss pairings, byes, repeat-pair prevention, and Swiss standings/tie-breakers consumed by the existing detail page. |
| T15 | Group Stage + Playoffs | Done | Added stage-aware standings table display while API handles group qualifiers feeding playoff brackets. |
| T16 | League/Season Engine | API Done | API now schedules league/season rounds and match times while the existing detail page renders scheduled matches and live tables. |
| T17 | Cumulative Scoring Engine | Done | Added admin cumulative scoring workflow for battle royale, racing, kill-count, placement, leaderboard, time-trial, and grand-prix heats. |
| T18 | Tournament Match-Room Linkage | Done | Hardened admin match-room linking with step-up, idempotent single-match retries, and API response support for existing/skipped links. |
| T19 | Tournament Match Workspace | Done | Upgraded linked match rooms into tournament-aware player workspaces with event context, match check-in, assigned opponent details, and evidence/result actions. |
| T20 | Admin Tournament Command Center | Done | Added live admin oversight panels for active tournaments: entrants, check-ins, seeding, rounds, linked rooms, reviews, disputes, and match-room access. |
| T21 | Tournament Leaderboard + Standings | Done | Upgraded tournament detail and admin command center with placements, records, points, tie-breakers, ranked scopes, and prize eligibility from live standings/allocation data. |
| T22 | Tournament Result Review | Done | Added admin tournament result decision workflow for score confirmation, disputes, voids, forfeits, no-shows, and DQs against live tournament matches. |
| T23 | Tournament Settlement | Done | Added admin tournament settlement workflows for prize payout reservation and participant-entry refund reservation, backed by tournament settlement/refund APIs. |
| T24 | Tournament Notifications + Invites | Done | Tournament event notifications now flow into the existing inbox for registration, check-in, match-ready, score, dispute, penalty, payout, and refund events. |
| T25 | Sponsor/Creator Tournament Tools | Done | Added admin sponsor/creator controls for tournament-scoped host grants, sponsor contribution tracking, and host-managed event copy/schedule settings. |
| T26 | Tournament Polish + Mobile QA | Done | Added tournament bracket-map polish, standings/audit refinements, admin audit views, and authenticated mobile/narrow viewport QA against live tournament data. |
| T27 | Security + Abuse Hardening | Done | Web tournament actions now consume hardened API responses for rate limits, moderation blocks, duplicate entries, duplicate funding, and host-grant restrictions. |
| T28 | Full QA + Regression | Done | Ran web regression, launch check, authenticated mobile/narrow browser QA, screenshot capture, and docs updates against live tournament data. |
| T29 | Closed Beta Tournament Readiness | Done | Added tournament admin closed-beta guide mapping operator runbooks to web routes, workflows, incident handling, and mobile QA expectations. |
| T30 | Tournament Evidence Upload Hardening | Done | Hardened evidence storage with strict file names, MIME/signature checks, metadata sidecars, safer serving headers, and tournament proof context. |
| T31 | Tournament Evidence Access Control | Done | Evidence serving now uses sidecar context metadata to allow uploaders, active operators, match participants/creators, and tournament creators/hosts only. |
| T32 | Tournament Evidence Audit Trail | Done | Evidence opens, denials, invalid requests, missing files, and metadata mismatches now write persistent audit events and surface in Risk Ops. |
| T33 | Tournament Evidence Retention Policy | Done | Hardened evidence now carries a closed-beta retention policy, expired files return 410, and operators have a dry-run retention report. |
| T34 | Tournament Evidence Legal Hold Workflow | Done | Risk Ops can apply/release legal hold on hardened evidence sidecars, preserving files beyond retention while keeping access control and audit events. |
| T35 | Tournament Evidence Export Package | Done | Risk Ops can download a hardened evidence JSON manifest with metadata, retention/legal-hold state, integrity checks, and audit events. |
| T36 | Tournament Evidence Chain-of-Custody Review | Done | Risk Ops can generate custody verdict reports with integrity findings, retention/legal-hold status, audit counts, and normalized timelines. |
| T37 | Tournament Evidence Admin Review Dashboard | Done | Risk Ops now groups evidence files by audit activity with verdicts, exceptions, retention/legal-hold state, signals, and direct review/export actions. |
| T38 | Tournament Evidence Storage Provider Adapter | Done | Evidence upload, serving, retention, legal hold, export, and custody flows now go through a provider adapter with local storage as the active closed-beta provider. |
| T39 | Tournament Evidence Cleanup/Quarantine Workflow | Done | Expired hardened evidence can be identified, quarantined out of active serving, restored by operators, and audited without permanent deletion. |
| T40 | Tournament Evidence Permanent Deletion Approval Workflow | Done | Permanent media deletion now requires quarantine, expiry, no legal hold, request, second-operator approval, third-operator execution, and tombstone metadata. |
| T41 | Tournament Evidence Provider Migration Readiness | Done | Final evidence infrastructure phase: added provider migration readiness reports, parity checklist, cutover checklist, and no live provider switch. |
| T42 | Tournament End-to-End Operator QA | Done | Added non-mutating operator QA gate, route/workflow coverage checks, evidence readiness integration, and web operator QA documentation. |
| T43 | Closed Beta Tournament Launch Checklist | Done | Added launch checklist gate, sign-off packet, route/evidence/money launch coverage, and accepted local-provider warning rules. |
| T44 | Live Closed Beta Tournament Dry Run | Done | Added dry-run rehearsal packet, transcript template, lifecycle/browser route coverage, and dry-run gate that requires manual authenticated rehearsal. |
| T45 | Final Tournament Regression + Docs Handoff | Done | Added final handoff, reran full regression gates, documented stop condition, and closed the tournament engine phased build. |
| C1 | Public Community Blueprint | Done | Added community/virality product blueprint, public share model, safe social-proof rules, privacy/moderation boundaries, and roadmap. |
| C2 | Public Leaderboards | Done | Added public leaderboard page, filters, player ranking pages, campus profile support, and public-safe community API bridge calls. |
| C3 | Winner Pages + Highlights | Done | Added highlights board, tournament winner pages, match winner pages, and featured highlight cards on the community board. |
| C4 | Public Share Cards | Done | Added OG metadata and generated image cards for community, highlights, public tournament winners, public room winners, and leaderboard ranks. |

See `docs/v3-product-ux-recovery.md` for the new source of truth.

## Legacy Phase Status

| Phase | Name | Status | Notes |
|---|---|---:|---|
| 0 | Product Blueprint + Repo Setup | Done | Next.js scaffold, design tokens, player shell, admin shell, docs, smoke test, and launch check created. |
| 1 | Auth + Security Foundation | Done | Cookie bridge, protected admin middleware, API-backed current-user lookup, dev sign-in, and logout route are in place. |
| 2 | Database + Domain State Machine | API Done | Consumed through `skill-rooms-api`; web role model now includes support operators. |
| 3 | Design System + App Shell | Done | Expanded design tokens, UI primitives, player shell, admin shell, lobby dashboard, and admin operations overview. |
| 4 | Player Profiles + Game Accounts | Done | Player profile page and admin player directory preview are in place. |
| 5 | Match Rooms V1 | Done | Live API-backed match lobby, create room form, join-by-code action, open-room action, and room timeline screen. |
| 6 | Manual Funding + Ledger | Done | Player funding form, room funding overview, admin queue, review actions, and step-up-token approval UI. |
| 7 | Evidence + Result Review | Done | Player result claim UI, opponent response UI, admin result queue, and step-up-token review UI. |
| 8 | Settlement + Refund Workflow | Done | Settlement command center, payout queue, refund queue, and step-up-token completion forms. |
| 9 | Admin Risk + Moderation | Done | Risk dashboard, flag creation, room holds, moderation audit trail, and step-up account actions. |
| 10 | Notifications + Community Layer | Done | Community page, leaderboard, activity feed, room invites, notifications inbox, invite responses, and preferences. |
| 11 | Testing + Launch Checks | Next | Browser verification, responsive screenshots, smoke flows. |
| 12 | Closed Beta Operations | Pending | Beta ops dashboards and reconciliation support. |
| 13 | Payment Upgrade Readiness | Pending | Future provider UI states and webhook status views. |

## Completed In Phase 0

- Next.js app scaffold.
- Token-driven Tailwind setup.
- Player app shell with match lobby preview.
- Admin operations shell with work queue preview.
- UI primitives: Button, Badge, StatusPanel.
- API client placeholder.
- Auth bridge placeholder.
- Launch check worker.

## Completed In Phase 1

- Access-token cookie naming with production hardened cookie name.
- API-backed `getCurrentUser`.
- Admin access helper.
- Middleware guard for `/admin`.
- Trusted-origin protection for mutating web requests.
- Development-only sign-in page.
- Development session route that proxies to `skill-rooms-api`.
- Logout route that clears auth cookies.
- Admin page verifies role through the API before rendering.

## Completed In Phase 3

- Expanded design tokens for operational surfaces, status tones, and shadows.
- Improved global layout and input defaults.
- Upgraded UI primitives:
  - Button variants/sizes
  - Badge tones
  - StatusPanel detail text
  - Panel and PanelHeader
  - SegmentedControl
  - Timeline
  - DataTable
  - EmptyState
- Upgraded player app shell with sticky responsive navigation.
- Upgraded admin shell with command sidebar and access context.
- Rebuilt lobby as a serious match workspace:
  - dark product hero
  - room lifecycle
  - metrics
  - available room table
  - reputation preview
- Rebuilt admin overview:
  - queue metrics
  - admin work table
  - approval lifecycle
  - owner/admin/moderator/support role summary
- Refreshed sign-in styling.

## Completed In Phase 4

- Added protected `/profile` route.
- Added profile readiness screen with profile fields, age confirmation copy, completion timeline, and connected game accounts table.
- Updated app navigation to point Profile to `/profile`.
- Added `/admin/players` route.
- Added admin player directory preview with readiness, pending handles, risk flags, and reputation columns.
- Added Players nav item to admin shell.

## Completed In Phase 5

- Updated player navigation so Matches points to `/matches`.
- Added authenticated match-room API bridge.
- Added server actions:
  - create draft room
  - join room by code
  - open room
- Added protected `/matches` route with live lobby list and join-code form.
- Added protected `/matches/new` route with COD Mobile room creation form.
- Added protected `/matches/[matchId]` route with live room details, participant slots, open-room action, and state timeline.
- Updated home page CTAs to point into the real match room flow.
- Kept payment/funding controls intentionally out of scope until Phase 6.

## Phase 5 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

Browser sanity:

- `/sign-in` shows the real Skill Rooms sign-in copy.
- `/register` shows the real account creation copy.
- The old development-role sign-in language is no longer visible.

## Completed In V3 Phase 3

- Added shared `AccountMenu` for signed-in identity, profile access, role-aware admin entry, and logout.
- Rebuilt the player app shell:
  - cleaner top bar
  - role-aware Ops link
  - primary create-room action
  - mobile bottom navigation
  - compact account control
- Rebuilt the admin shell:
  - sharper ops identity
  - horizontal mobile admin nav
  - desktop sticky operations header
  - player-app switch
  - account control on desktop and mobile
  - removed dead admin navigation entries that pointed back to `/admin`
- Kept shell work scoped so the next phase can focus on the lobby itself.

## V3 Phase 3 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

Browser note: the in-app browser blocked localhost with `ERR_BLOCKED_BY_CLIENT`, so visual screenshot verification still needs to be rerun when localhost access is available.

## Completed In V3 Phase 4

- Rebuilt `/` as the player lobby instead of a static preview dashboard.
- The lobby now requires a signed-in Skill Rooms account.
- Lobby room data loads through the live match-room API.
- Added mobile-first room cards with:
  - room code
  - status
  - entry amount
  - player count
  - next-action context
  - view/join controls
- Added join-code form directly to the lobby hero.
- Added real lobby metrics from room statuses:
  - open rooms
  - funding
  - live flow
  - review
- Added trust guidance for funding and evidence review.
- Replaced old static room rows and removed user-facing roadmap language from nearby player screens.
- Updated join-room server action so lobby errors return to `/` instead of forcing `/matches`.

## V3 Phase 4 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

Source scan:

```bash
rg "Later phases|preview data|V1|preview|Evidence later|strict auth bridge|Development access|Phase [0-9]" src -n
```

Result: no user-facing matches. Only the internal `phase0-smoke.test.ts` file still contains phase wording.

## Completed In V3 Phase 5

- Rebuilt `/matches/[matchId]` as the main room workspace.
- Added clear room hero with:
  - current room status
  - room code
  - entry amount
  - player count
  - room-level actions
- Added "next action" panel so players know what needs to happen now.
- Added compact room metrics:
  - entry
  - players
  - state
  - next step
- Rebuilt player slots with fixed two-player room context.
- Rebuilt funding area into player-specific funding cards.
- Kept manual funding submission in the room workspace and disabled it when the room state does not allow funding.
- Rebuilt result area into claim cards with evidence state and winner context.
- Kept result submission in the room workspace and disabled it when the room state does not allow result claims.
- Added opponent response panel for the latest claim.
- Moved detailed state history into a compact audit trail at the bottom.
- Removed fake copy button and table-heavy layout from the top-level player room experience.

## V3 Phase 5 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

Source scan:

```bash
rg "Later phases|preview data|V1|preview|Evidence later|strict auth bridge|Development access|Phase [0-9]" src/app src/components -n
```

Result: no matches.

## Completed In Phase 6

- Extended match-room API bridge with:
  - room funding overview
  - manual funding submission
  - admin funding queue
  - admin funding review
- Added player funding submission form to `/matches/[matchId]`.
- Added room funding submissions table to `/matches/[matchId]`.
- Added `/admin/funding` route.
- Added admin funding queue with submitted transfers.
- Added approve/reject review form for admin-sensitive review actions.
- Updated admin navigation to point Funding at `/admin/funding`.

## Phase 6 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

## Completed In Phase 7

- Extended match-room API bridge with:
  - room result overview
  - result claim submission
  - opponent response submission
  - admin result queue
  - admin result review
- Added result claim and evidence form to `/matches/[matchId]`.
- Added opponent agree/dispute response form to `/matches/[matchId]`.
- Added result claims table to room detail.
- Added `/admin/results` route.
- Added admin result review queue with submitted result claims.
- Added approve/reject/dispute/void review form for admin-sensitive review actions.
- Updated admin navigation to include Results.

## Phase 7 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

## Completed In Phase 8

- Extended match-room API bridge with:
  - settlement queue
  - payout queue
  - refund queue
  - settlement reservation
  - payout completion
  - refund reservation
  - refund completion
- Added `/admin/settlements` route.
- Added queued winner payout table.
- Added queued refund table.
- Added settlement reservation form.
- Added refund reservation form.
- Added payout/refund completion forms with admin-sensitive confirmation and bank references.
- Updated admin navigation to include Settlements.

## Phase 8 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

## Completed In Phase 9

- Extended match-room API bridge with:
  - risk dashboard
  - risk flag queue
  - risk flag creation/status update
  - moderation action queue
  - account moderation action creation
  - room hold queue
  - create/release room hold
- Added `/admin/risk` route.
- Added risk flags table.
- Added room holds table.
- Added moderation action audit table.
- Added risk flag creation form.
- Added risk flag status update form.
- Added room hold/release forms.
- Added step-up-gated account moderation form.
- Updated admin navigation to point Risk to `/admin/risk`.

## Phase 9 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

## Completed In Phase 10

- Extended API bridge with:
  - notifications
  - notification read/read-all
  - notification preferences
  - room invites
  - invite responses
  - activity feed
  - leaderboard
- Added `/community` route.
- Added `/notifications` route.
- Updated player navigation with Community and Notifications.
- Added leaderboard table.
- Added activity feed table.
- Added room invite form.
- Added unread notifications table.
- Added invite accept/decline controls.
- Added notification preferences form.

## Phase 10 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

## Completed In V3 Phase 2

- Replaced the `/sign-in` dev-role form with a real Skill Rooms email/password sign-in screen.
- Added `/register` for player account creation.
- Added web auth route handlers:
  - `POST /api/auth/login`
  - `POST /api/auth/register`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
- Removed the old web development-session route.
- Added httpOnly access-token and refresh-token cookies.
- Updated logout to invalidate the backend refresh session before clearing cookies.
- Added visible sign-out controls to the player and admin shells.
- Removed development-auth language from the sign-in screen.
- Updated env example to stop advertising dev auth as the normal web path.

## V3 Phase 2 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

## Verification Run

```bash
npm install
npm run typecheck
npm run test
npm run launch:check
npm run build
npm run lint
npm audit
```

Result: all passed, with zero audit vulnerabilities.

## Phase 1 Verification Run

```bash
npm run typecheck
npm run test
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

Live smoke:

- `/admin` redirects without a session.
- `/sign-in` returns 200.

## Phase 3 Verification Run

```bash
npm run typecheck
npm run test
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

Live smoke:

- `/` returns 200.
- `/sign-in` returns 200.
- `/admin` redirects without a session.
- Dev server restarted cleanly on port `3100`.

## Completed In V3 Phase 6

- Added reusable admin UI components:
  - `AdminPageHeader`
  - `AdminQueueCard`
  - `AdminEmptyState`
- Rebuilt `/admin` from static placeholder queue data into live queue aggregation across:
  - funding submissions
  - result claims
  - settlement reservations
  - payout queue
  - refund queue
  - risk flags
  - room holds
- Reworked `/admin/funding` into a review workspace with visible submission IDs, room IDs, player IDs, transfer references, bank details, proof links, and a sticky decision panel.
- Reworked `/admin/results` into a review workspace with visible claim IDs, room IDs, claimant/winner context, score summary, notes, and a sticky decision panel.
- Tightened `/admin/settlements` with the V3 header and empty states for clear payout/refund queues.
- Tightened `/admin/risk` with the V3 header and empty states for flags, holds, and moderation actions.
- Removed fake player rows from `/admin/players`; the view now avoids invented player metrics or identities when no live player directory API is available.

## V3 Phase 6 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

## Completed In V3 Phase 7

- Added web API types and clients for:
  - `GET /profiles/me`
  - `GET /profiles/trust/:userId`
- Added reusable `PlayerTrustCard`.
- Rebuilt `/profile` to use real profile, game-account, completion, risk, and trust data instead of static values.
- Added player trust cards to room slots on `/matches/[matchId]`.
- Upgraded `/community` leaderboard with disputes and no-show signals plus honest empty states.
- Rebuilt `/admin/players` into a reputation/trust review surface using live leaderboard records.
- Kept moderation/risk visibility scoped: normal players see safe trust status; operators can receive risk flag counts through the trust endpoint.

## V3 Phase 7 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

## Completed In V3 Phase 8

- Upgraded design tokens in `src/styles/tokens.ts`:
  - stronger neutral palette
  - refined action/success/warning/danger tones
  - shared spacing tokens
  - tightened radius scale
  - added lift shadow
  - defined type scale
- Updated Tailwind to expose the new spacing and type scale.
- Upgraded global CSS with:
  - more polished background grid
  - safer text rendering
  - selection styling
  - reduced-motion handling
- Upgraded core primitives:
  - `Button`
  - `Badge`
  - `Panel`
  - `PanelHeader`
  - `StatusPanel`
  - `DataTable`
  - `EmptyState`
  - `SegmentedControl`
- Added new V3 primitives:
  - `Skeleton`
  - `SkeletonPanel`
  - `ErrorState`
  - `Tabs`
  - `Toast`
  - `MobileSheet`
- Added app-level loading and error routes:
  - `src/app/loading.tsx`
  - `src/app/error.tsx`
  - `src/app/admin/loading.tsx`
  - `src/app/admin/error.tsx`
- Tightened player/admin shell spacing and primary controls with shared page padding and control heights.

## V3 Phase 8 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

## Completed In V3 Phase 9

- Re-scanned real pages for static visible metrics, preview rows, and demo data.
- Wired `/community` pending invite count to `listRoomInvites("pending")`.
- Replaced `/community` static game-lane metric with aggregate completed match history from the leaderboard API.
- Reworked `/notifications` to:
  - show email/SMS status from real notification preferences
  - show proper empty states instead of blank notification/invite tables
- Added web client support for `GET /games`.
- Reworked `/matches/new` to load active games and rulesets from the API instead of hard-coding the COD Mobile ruleset into visible fields.
- Removed the dead `Save and open later` action from create-room.
- Added an empty state when no active game/ruleset exists.

## V3 Phase 9 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

## Owner Setup Flow

- Added `/owner-setup`.
- Added `POST /api/auth/owner-setup`.
- The sign-in screen links to owner setup only when the API says setup is available.
- Owner setup submits owner name, email, and password to the API.
- Successful setup sets auth cookies and redirects to `/admin`.
- If an owner already exists, `/owner-setup` shows a locked state and links back to sign-in.

## Owner Setup Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

## Completed In V3 Auth Enhancement

- Changed account creation from `Display name` to `Username`.
- Added confirm-password fields to player registration and owner setup.
- Added a stable reusable password field with an explicit show/hide eye button.
- Changed sign-in to accept `Email or username`.
- Added `POST /api/auth/google` cookie bridge.
- Added Google sign-in/sign-up buttons on `/sign-in` and `/register`.
- Added `POST /api/auth/google/link` for signed-in users linking Google to their existing account.
- Added profile-page Google link status and account-linking control.
- Added `NEXT_PUBLIC_GOOGLE_CLIENT_ID` web env support.
- Kept all auth paths on the owned Skill Rooms access/refresh cookie model.

## V3 Auth Enhancement Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities.

## Completed In V3 Phase 10

- Rebuilt `DataTable` to render mobile card rows below `md`, avoiding cramped horizontal table scrolling on phone widths.
- Hardened `SegmentedControl`, `Panel`, `PanelHeader`, and `StatusPanel` with max-width/min-width protections so actions, badges, and large numbers do not push pages wider than the viewport.
- Updated `PlayerTrustCard` metrics from four forced mobile columns to two mobile columns and four wider-screen columns.
- Tightened `AppShell` bottom navigation spacing and page-bottom padding so fixed mobile nav does not sit on top of content.
- Added safer global media constraints and moved smooth scrolling to the Next-recommended `data-scroll-behavior` attribute.
- Reworked player/admin responsive grids from overflow-prone `1fr` tracks to `minmax(0, 1fr)` tracks.
- Changed repeated stat grids from `md:grid-cols-4` to `sm:grid-cols-2 lg:grid-cols-4` so cards breathe on tablet/mobile widths.
- Applied the hardening pass across lobby, rooms, room detail, profile, community, notifications, admin overview, funding, results, settlements, risk, players, and loading states.

## V3 Phase 10 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm run launch:check
npm audit
```

Result: all passed, with zero audit vulnerabilities. A local HTTP smoke check returned `200` for `/profile` after restarting the stale dev server.

## Completed In Tournament Engine Phase T3

- Added tournament API bridge types and clients:
  - tournament formats, statuses, fee modes, scoring modes, prize split modes
  - `listTournaments`
  - `createTournament`
  - shared enum and money format helpers
- Added `/admin/tournaments`.
- Added admin navigation entry for Tournaments.
- Added server action for tournament creation.
- Added real admin creation controls for:
  - game and ruleset
  - tournament format
  - solo/team entry type
  - free/paid/sponsored/hybrid fee mode
  - match win/loss, cumulative score, points, and placement scoring
  - winner-take-all, top-2, top-3, custom fixed, and custom percentage prize distribution
  - entry fee, sponsor pool, guaranteed pool, commission
  - min/max entries and team size
  - registration/start/end schedule
  - evidence requirement, match check-in, waitlist, and tie-breaker settings
- Added live tournament queue from the API with status, format, game, entry count, start time, and prize exposure.
- Added operations metrics for open registration, drafts, active tournament ops, and prize exposure.

## Tournament Engine Phase T3 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed. Browser QA confirmed `/admin/tournaments` is protected and redirects unauthenticated users to sign-in with `redirect=/admin/tournaments`.

## Completed In Tournament Engine Phase T4

- Added `/tournaments` as the player-facing tournament board.
- Updated player navigation:
  - desktop nav now includes `Tournaments`
  - mobile nav now uses `Lobby | Rooms | Tourneys | Inbox | Profile`
  - `Profile` remains pinned in the mobile nav
- Added tournament listing UI backed by the live API:
  - visible published/live/completed tournaments only
  - filters for all, open registration, live/in-motion, and completed
  - status, fee-mode, format, game, scoring, entries, schedule, prize pool, entry fee, prize split, entry type, and team size
  - operations-safe empty states with no fake event rows
- Added tournament metrics:
  - open tournaments
  - live/in-review tournament operations
  - completed tournaments
  - projected/approved prize pools
- Extended `SegmentedControl` to support link-backed segments while preserving existing button behavior.

## Tournament Engine Phase T4 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed. Browser QA found a stale/hung local dev-server state after route changes; the temporary port `3101` process was stopped. Re-run browser visual QA from a clean signed-in dev session before calling mobile visual QA complete.

## Completed In Tournament Engine Phase T5

- Added tournament detail API bridge:
  - `getTournamentDetail`
  - typed tournament stages, rounds, matches, prize allocations, prize contributions, and state events
- Added `/tournaments/[tournamentId]`.
- Linked tournament cards and table rows from `/tournaments` to the detail page.
- Added player-facing tournament detail sections:
  - event hero with status, fee mode, format, and admin manage link for operators
  - registration, entries, prize pool, and format metrics
  - tournament policy grid
  - lifecycle timeline
  - prize pool and prize allocations
  - registration readiness
  - stages and matches
  - linked match-room access when tournament matches have rooms
  - tournament audit history
- Guarded draft/cancelled/voided tournament detail visibility for non-operators.
- Kept empty states honest for structure, allocations, and matches that have not been generated yet.

## Tournament Engine Phase T5 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T6

- Added tournament registration API bridge:
  - `registerForTournament`
  - typed `TournamentEntry`
  - typed `TournamentEntryMember`
- Added registration server action on tournament detail pages.
- Updated `/tournaments/[tournamentId]`:
  - registration status/error/success messaging
  - registration form
  - solo/team-aware team name input
  - disabled state when registration is closed
  - disabled state when the signed-in user is already registered
  - profile/game-account readiness guidance
  - real entrant table from API detail data
  - roster count per entry
  - entry funding/status badges
- Kept check-in copy scoped to the upcoming T7 phase while preserving real roster data now.

## Tournament Engine Phase T6 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T7

- Added tournament check-in API bridge:
  - `checkInForTournament`
- Added tournament check-in server action.
- Updated `/tournaments/[tournamentId]`:
  - check-in success/error messaging
  - separate check-in control after registration
  - disabled state when check-in is closed
  - disabled state when user is not registered or already checked in
  - explicit note that paid/hybrid entries need approved funding first
  - check-in count status copy
  - entrant table check-in timestamp column

## Tournament Engine Phase T7 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T8

- Added tournament contribution API bridge:
  - `submitTournamentContribution`
  - `listTournamentContributions`
  - `reviewTournamentContribution`
- Added contribution submission form on `/tournaments/[tournamentId]`:
  - participant entry fee
  - sponsor contribution
  - amount
  - transfer reference
  - proof screenshot upload
  - proof URL fallback
  - notes
- Added tournament contribution review queue on `/admin/tournaments`.
- Review controls require an active admin step-up unlock and support approve/reject decisions.
- Contribution queue shows tournament, source, amount, proof link, and review controls.

## Tournament Engine Phase T8 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T9

- Added tournament seeding API bridge:
  - `seedTournament`
- Added seeding server action on `/admin/tournaments`.
- Added an admin seeding engine panel with:
  - tournament selector
  - registration-order seed mode
  - random draw seed mode
  - reputation-ranking seed mode
  - manual seed-order textarea
  - operator-provided audit reason
- Exposed tournament IDs in the admin tournament queue so operators can build manual seed orders from real entrant IDs.
- Added success/error routing for seed assignment without using static preview data.

## Tournament Engine Phase T9 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T10

- Added tournament structure API bridge:
  - `generateTournamentStructure`
- Added an admin stage generator panel on `/admin/tournaments`:
  - tournament selector
  - audit reason
  - explicit regenerate checkbox
  - generate stages action
- Added success/error routing for structure generation.
- Added `match_sides` typing to tournament detail payloads.
- Updated tournament detail match tables to show generated entrants/pairings/heats from match sides instead of only showing match shell rows.

## Tournament Engine Phase T10 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed Early For Tournament Engine Phase T18

- Added tournament match room linking API bridge:
  - `linkTournamentMatchRooms`
- Added an admin match room linker panel on `/admin/tournaments`:
  - tournament selector
  - optional round ID
  - optional match ID
  - audit reason
  - link match rooms action
- Link success/error states now return to the tournament ops page.
- Linked tournament matches reuse the existing tournament detail room links because `match_room_id` is written back to tournament matches.

## Tournament Engine Phase T18 Foundation Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T11

- API-owned single-elimination behavior now powers the tournament detail data already shown in the web app:
  - bye results
  - completed match status
  - advanced entrants in later rounds
  - optional bronze match shell
  - linked match-room result advancement
- No new standalone web page was needed in this phase because tournament detail already renders generated stages, matches, match sides, and linked rooms from the API.

## Tournament Engine Phase T11 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T12

- API-owned double-elimination behavior now powers the tournament detail data already shown in the web app:
  - winners bracket progression
  - losers bracket drops and elimination paths
  - bye results and auto-advanced entrants
  - sparse-bracket bye propagation
  - grand-final and conditional reset match shells
  - linked match-room result advancement
- No new standalone web page was needed in this phase because tournament detail already renders generated stages, rounds, matches, sides, statuses, and linked rooms from the API.

## Tournament Engine Phase T12 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T13

- Added tournament standings to the web API type model.
- Added a live standings table to tournament detail:
  - rank
  - entry
  - seed
  - points
  - wins
  - losses
  - draws
  - score difference
  - points for
- The tournament detail page now consumes API-owned round-robin table data generated from approved match-room results.

## Tournament Engine Phase T13 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T14

- API-owned Swiss behavior now feeds the tournament detail data already shown in the web app:
  - generated Swiss rounds
  - dynamic next-round matches
  - Swiss bye matches
  - standings table updates
  - Buchholz and opponent match-win percentage tie-breaker metadata
- No new standalone web page was needed in this phase because tournament detail already renders stages, matches, match sides, linked rooms, and the live standings table from the API.

## Tournament Engine Phase T14 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T15

- Updated tournament detail standings display for multi-stage events:
  - standings now include the source stage/group label
  - standings are sorted by stage order and rank
  - group-stage, playoff, Swiss, and table formats can share the same live standings panel without mixing groups together visually
- API-owned group-stage playoff behavior now feeds the existing tournament detail page:
  - group standings
  - playoff match slots
  - playoff byes
  - linked match-room advancement

## Tournament Engine Phase T15 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T16

- API-owned league/season scheduling now feeds the tournament detail data already shown in the web app:
  - scheduled round starts
  - scheduled match times
  - live standings tables
  - completed round/stage status
  - season completion routing toward settlement
- No new standalone web page was needed in this phase because tournament detail already renders scheduled match times and the live standings table from the API.

## Tournament Engine Phase T16 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T17

- Added web API bridge support for admin cumulative scoring:
  - `applyTournamentCumulativeScores`
  - typed result rows for entry ID, placement, score, kills, time, bonus, and penalty
  - admin step-up header support
- Added admin tournament console scoring workflow:
  - tournament selector
  - generated match ID input
  - admin step-up confirmation
  - reason input
  - multi-line result entry form
- Added operator-friendly result parsing:
  - one entrant per line
  - comma or tab separated values
  - format: `entry-id, placement, score, kills, time_ms, bonus, penalty`
- Added success routing for scored tournaments on `/admin/tournaments`.
- Existing tournament detail standings now consume the API-updated cumulative standings without a separate display fork.

## Tournament Engine Phase T17 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T18

- Hardened the admin tournament match-room linker on `/admin/tournaments`:
  - added required admin step-up confirmation
  - kept round-level and specific-match linking controls
  - clarified that single-match retries safely return existing links
- Updated the web API bridge for the hardened linker:
  - sends `x-admin-step-up`
  - supports existing linked room responses
  - supports skipped match reason details from the API
- Existing tournament detail pages continue to render linked match-room access through `match_room_id` on tournament matches.

## Tournament Engine Phase T18 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T19

- Added web API bridge support for tournament match-room check-in:
  - `checkInTournamentMatchRoom`
  - typed `TournamentMatchCheckIn`
  - timeline payload support for `tournament_match_check_ins`
- Upgraded `/matches/[matchId]` into a tournament-aware workspace when the room is linked to a tournament match:
  - tournament title context
  - stage, round, and match number
  - generated matchup sides and seeds
  - assigned entry IDs
  - per-player check-in status
  - current-player check-in action
  - link back to the tournament detail page
- Preserved existing match-room evidence/result actions:
  - winner claim
  - evidence upload/link
  - opponent response
  - audit timeline
- Kept normal wager/private room funding and invite flows separate:
  - tournament rooms hide manual funding submission because event entry/prize policy owns funding
  - tournament rooms disable ad hoc invites because opponents are assigned by the tournament engine
- Updated page copy to stay game-generic instead of COD-only.

## Tournament Engine Phase T19 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T20

- Upgraded `/admin/tournaments` from separate action panels into a command-center surface with live oversight data.
- Added active tournament command-center loading from real tournament detail API records.
- Added command-center summary metrics:
  - loaded active events
  - entrants
  - event check-ins
  - tournament match check-ins
  - matches needing result/review/dispute oversight
- Added per-event operations panels:
  - tournament status and format
  - entrant count and max slots
  - seeded entry count
  - registration check-in count
  - player match check-in count
  - active/open rounds
  - linked match rooms
- Added match oversight tables:
  - match number
  - status
  - assigned entrants
  - direct linked room access
- Kept existing admin workflows on the same page:
  - contribution review
  - seeding
  - stage generation
  - match-room linking
  - cumulative scoring
  - tournament creation

## Tournament Engine Phase T20 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T21

- Upgraded tournament detail standings into a full leaderboard surface:
  - placement/rank display
  - entry label and seed context
  - stage/group scope
  - W-L-D record
  - points
  - configured tie-breaker policy summary
  - live tie-breaker values
  - prize eligibility by explicit allocation row
- Added leaderboard summary metrics:
  - ranked entries
  - prize-eligible rows
  - top points
  - tie policy visibility
- Upgraded admin tournament command center with compact per-event leaderboard oversight:
  - top placements
  - stage scope
  - points
  - payout-band visibility
  - prize eligibility counts
- Kept standings driven by the existing API detail payload:
  - no static rows
  - no duplicate leaderboard store
  - prize eligibility derives from `tournament_prize_allocations`

## Tournament Engine Phase T21 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T22

- Added web API support for tournament match result review:
  - result decision enum
  - tournament result review payload type
  - `reviewTournamentMatchResult`
- Added admin command-center result decision workflow:
  - score confirmation
  - disputed match routing
  - void match routing
  - forfeit entry
  - no-show entry
  - disqualify entry
- The admin form captures:
  - tournament ID
  - tournament match ID
  - winning entry ID
  - penalized entry ID
  - optional linked result claim ID
  - score summary
  - review note
  - admin step-up confirmation
- Kept the workflow live-data only:
  - no preview claims
  - no static tournament rows
  - decisions call the API and redirect with success/error state

## Tournament Engine Phase T22 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T23

- Added web API support for tournament settlement:
  - tournament settlement type
  - tournament payout type
  - tournament refund type
  - `reserveTournamentSettlement`
  - `reserveTournamentRefunds`
- Added admin tournament settlement actions:
  - reserve prize payouts
  - reserve entry refunds
  - session-bound admin step-up enforcement through the API bridge
- Added `/admin/tournaments` settlement panel:
  - reserve payout queues from prize allocations/standings
  - queue participant-entry refunds
  - collect operator notes/reasons
  - display success/error redirects from real API results
- Kept settlement manual/provider-ready:
  - no automated Kora/bank execution
  - reservation queues are created for operator payout/refund workflows

## Tournament Engine Phase T23 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T24

- Tournament notifications now reuse the existing notifications page and API payloads.
- No new web inbox was required because the backend emits tournament notifications into `user_notifications`.
- Existing `/notifications` now receives:
  - registration notices
  - check-in confirmations
  - match-ready assignments
  - score/result review updates
  - dispute/void/penalty notices
  - payout queued notices
  - refund queued notices
- Existing notification preferences remain the user-facing control layer for in-app notification delivery.

## Tournament Engine Phase T24 Verification Run

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T25

- Added client API contracts for tournament hosts and host-managed event updates.
- Added admin action support for:
  - granting creator, co-host, or sponsor access
  - setting tournament-scoped permissions
  - updating event title, description, schedule, sponsor label, sponsor URL, creator notes, and featured flag
- Added sponsor/creator tools to the admin tournament console.
- Added sponsor tracking cards for active tournaments:
  - approved sponsor money
  - pending sponsor money
  - rejected sponsor money
  - active hosts and sponsor hosts
- Rendered host permission rows from live tournament detail payloads.
- Kept host access tournament-scoped so collaborators are not promoted into global platform operators.

## Tournament Engine Phase T25 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T26

- Added a player-facing `Competition map` to tournament detail pages with stage progress, round columns, match cards, seed labels, match results, byes/pending sides, and linked-room status.
- Expanded tournament history into an admin-grade audit view with state, reason, actor, timestamp, and metadata summaries.
- Added recent tournament state/audit events into the admin tournament command center for operator review.
- Verified the polished tournament detail surface with live seeded QA data covering bracket matches, standings, prize eligibility, sponsor funding, and audit rows.
- Verified the admin command center with the QA tournament loaded so entrants, check-ins, seeding, rounds, sponsor tools, standings, match oversight, and audit state are visible from live API payloads.
- Confirmed the narrow/mobile browser viewport does not have accidental document overflow; the dense admin tab strip intentionally remains horizontally scrollable on small widths.

## Tournament Engine Phase T26 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
```

Result: all passed.

Browser QA:

- Authenticated admin session at `http://localhost:3100/admin/tournaments`.
- Public QA tournament detail at `http://localhost:3100/tournaments/945b2294-01b9-4270-b9eb-c65699b883e1`.
- Verified bracket map, standings/prize eligibility, tournament history metadata, admin command center, sponsor tools, and admin audit trail with no runtime error.
- Cleared stale `.next` output and restarted the web dev server after a missing chunk runtime error from the prior dev cache.

## Completed In Tournament Engine Phase T27

- No new web UI was required for this hardening pass because the existing tournament server actions already surface API error messages to players and operators.
- Documented that tournament security/abuse enforcement now comes from the API layer:
  - rate-limited registration, check-in, funding, and admin mutations
  - moderation-status blocks for restricted, suspended, and banned accounts
  - duplicate active-entry and duplicate active entry-funding protection
  - host-grant target restrictions for inactive, suspended, or banned users
- The public tournament detail page, admin tournament command center, and host/sponsor controls remain compatible with the hardened API responses.

## Tournament Engine Phase T27 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T28

- Ran the web regression stack:
  - typecheck
  - lint
  - smoke test
  - production build
  - launch check
- Ran authenticated narrow/mobile browser QA at `599x550`.
- Captured mobile/narrow screenshots for:
  - public tournament board
  - public tournament detail
  - admin tournament command center
- Verified the public tournament board loads live API data with no runtime error and no accidental full-page horizontal overflow.
- Verified the tournament detail page loads the QA tournament with no runtime error and no accidental full-page horizontal overflow.
- Verified tournament detail DOM contains the competition map, semifinals, and final content; the narrow screenshot pass could not frame the competition map cleanly because the long roster/prize table dominated scroll positioning in the in-app browser.
- Verified the admin tournament command center loads the live QA tournament with no runtime error and no accidental full-page overflow. The admin ops tab strip intentionally remains horizontally scrollable on narrow width.
- Cleared stale `.next` output and restarted the local dev server after a stale chunk/runtime issue appeared during browser QA.
- The web dev server required approved execution on Windows because the sandboxed Next dev process hit `spawn EPERM`.

T28 screenshot artifacts:

- `C:\Users\HP\Documents\Codex\2026-05-29\absolutely-fam-i-agree-with-you\artifacts\t28-mobile-tournaments-board-clean.png`
- `C:\Users\HP\Documents\Codex\2026-05-29\absolutely-fam-i-agree-with-you\artifacts\t28-mobile-tournament-detail-map-clean.png`
- `C:\Users\HP\Documents\Codex\2026-05-29\absolutely-fam-i-agree-with-you\artifacts\t28-mobile-admin-tournaments-clean.png`

## Tournament Engine Phase T28 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
```

Result: all passed. Browser QA also passed for page load, runtime health, live data, and overflow checks, with the bracket-map screenshot framing limitation noted above.

## Completed In Tournament Engine Phase T29

- Added `docs/tournament-admin-closed-beta-guide.md` for tournament operator workflows in the web app.
- Mapped closed-beta tournament operations to routes:
  - `/admin/tournaments`
  - `/admin/funding`
  - `/admin/results`
  - `/admin/settlements`
  - `/admin/risk`
  - `/tournaments`
  - `/tournaments/[tournamentId]`
  - linked `/matches/[matchId]`
  - `/notifications`
- Documented the admin workflow from creation through settlement/refunds.
- Added web-specific incident handling steps for result review, risk tools, room holds, notifications, and settlement/refund gating.
- Added mobile/narrow QA expectations for tournament board, detail, command center, bracket map, tables, and admin action forms.
- Cross-referenced the API runbook as the source of truth for reconciliation and policy.

## Tournament Engine Phase T29 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T30

- Hardened `storeEvidenceFile` for match result evidence, match funding proof, and tournament contribution proof.
- New stored evidence files now use `evidence-v1_<context>_<user>_<uuid>.<ext>` names.
- Added sidecar metadata for new evidence files:
  - context ID
  - context type
  - uploader user ID
  - MIME type
  - evidence type
  - byte size
  - SHA-256 digest
  - creation timestamp
- Added basic content signature checks for PNG, JPG, WEBP, MP4, WEBM, and MOV files before writing to local storage.
- Hardened the evidence-serving route:
  - rejects path traversal and loose filenames
  - validates sidecar metadata for hardened files
  - requires authentication
  - limits hardened-file access to uploader or support/moderator/admin/owner
  - emits `nosniff`, CSP sandbox, private cache, and explicit content-disposition headers
- Kept legacy pre-hardening evidence files viewable to authenticated users with an `x-evidence-storage: legacy` response marker so old proof links do not break.
- Tournament contribution uploads now store evidence with tournament context metadata.

## Tournament Engine Phase T30 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T31

- Upgraded the hardened evidence serving route from uploader/operator-only checks to context-aware authorization.
- Hardened match-room evidence can now be opened by:
  - the uploader
  - active support/moderator/admin/owner operators
  - the match room creator
  - reserved or joined participants in that match room
- Hardened tournament evidence can now be opened by:
  - the uploader
  - active support/moderator/admin/owner operators
  - the tournament creator
  - active tournament hosts
- Evidence access decisions are made from the stored sidecar metadata context:
  - `contextType`
  - `contextId`
  - `uploadedByUserId`
- The evidence route calls the API with the current access token before serving files, so participant/host access is based on live room/tournament data.
- Hardened responses now emit `x-evidence-access` so operators can inspect why access was granted without exposing that detail in the UI.
- Legacy pre-hardening files remain authenticated-only because they do not have context metadata.

## Tournament Engine Phase T31 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T32

- Evidence file serving now sends non-blocking audit records to the API for:
  - allowed hardened and legacy evidence opens
  - denied hardened evidence opens
  - invalid filename/path requests
  - metadata mismatches
  - missing file attempts
- Audit payloads include file, storage mode, access reason, status code, context type, context ID, uploader ID, evidence type, MIME type, byte size, and SHA-256 when available.
- The web route forwards browser user-agent and forwarded IP metadata to the API audit endpoint.
- Added a typed web client for evidence access events.
- Added an Evidence Audit section to Risk Ops so support/admin users can review recent evidence access activity alongside risk flags, room holds, and moderation actions.

## Tournament Engine Phase T32 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
```

Result: all passed.

## Completed In Tournament Engine Phase T33

- Added a closed-beta evidence retention policy:
  - policy ID: `closed_beta_evidence_retention_v1`
  - default retention: 180 days
  - legacy review window: 30 days
- New hardened evidence sidecar metadata now includes:
  - retention policy ID
  - retention days
  - retain-until timestamp
  - legal-hold flag
  - retention reason
- Older hardened sidecars without explicit retention metadata are interpreted using the same 180-day policy from `createdAt`.
- The evidence-serving route now evaluates retention before release:
  - active files continue through normal access control
  - legal-hold files continue through normal access control
  - expired hardened files return `410 Gone`
- Allowed hardened evidence responses now include:
  - `x-evidence-retention-state`
  - `x-evidence-retain-until`
- Evidence access audit events now include retention fields when available.
- Added a dry-run retention report worker and script:
  - `npm run evidence:retention:check`
- Added `docs/evidence-retention-policy.md` as the web-side retention source of truth.

## Tournament Engine Phase T33 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
npm run evidence:retention:check
```

Result: all passed. The retention checker found zero local evidence sidecars and zero expired/metadata-error files.

## Completed In Tournament Engine Phase T34

- Added legal-hold fields to hardened evidence retention sidecars:
  - legal-hold status
  - operator user ID
  - hold timestamp
  - release operator user ID
  - release timestamp
  - operator reason
- Added a server-side legal hold mutation helper for hardened evidence files.
- Legal hold can only be changed for hardened `evidence-v1_*` files.
- Legal-hold state keeps evidence available past retention expiry, but still under normal evidence access-control rules.
- Added a Risk Ops legal-hold form for moderators/admins/owners to apply or release hold by evidence file name.
- Legal-hold changes send API evidence audit events:
  - `legal_hold_applied`
  - `legal_hold_released`
- The retention dry-run report now includes legal-hold operator/release metadata when present.
- Updated `docs/evidence-retention-policy.md` with the legal-hold workflow.

## Tournament Engine Phase T34 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
npm run evidence:retention:check
```

Result: all passed. The retention checker found zero local evidence sidecars and zero expired/metadata-error files.

## Completed In Tournament Engine Phase T35

- Added evidence export manifest generation for hardened `evidence-v1_*` files.
- Export packages include:
  - file name
  - secure evidence URL
  - sidecar context
  - uploader ID
  - MIME type and evidence type
  - metadata byte size
  - disk byte size
  - metadata SHA-256
  - recomputed SHA-256
  - retention state
  - legal-hold metadata
  - matching evidence audit events
- Added protected export route:
  - `GET /api/evidence-export?file_name=...`
- Added Risk Ops export form for support/moderator/admin/owner operators.
- The export route records an `exported` evidence audit event after generating a package.
- Export packages intentionally do not embed raw media bytes; they point to the protected evidence URL.
- Updated `docs/evidence-retention-policy.md` with the export workflow.

## Tournament Engine Phase T35 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
npm run evidence:retention:check
```

Result: all passed. The retention checker found zero local evidence sidecars and zero expired/metadata-error files.

## Completed In Tournament Engine Phase T36

- Added chain-of-custody review generation for hardened evidence files.
- Custody reviews include:
  - verdict: `clean`, `review_required`, or `exception`
  - integrity findings
  - disk-vs-metadata byte-size check
  - SHA-256 recomputation check
  - retention/legal-hold status
  - access denial count
  - custody exception count
  - legal-hold event count
  - export event count
  - prior chain-review count
  - first/last audit timestamps
  - normalized audit timeline
- Added protected review route:
  - `GET /api/evidence-chain?file_name=...`
- Added Risk Ops custody review form.
- The review route records a `chain_reviewed` evidence audit event after generating a report.
- Updated `docs/evidence-retention-policy.md` with the chain-of-custody workflow.

## Tournament Engine Phase T36 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
npm run evidence:retention:check
```

Result: all passed. The retention checker found zero local evidence sidecars and zero expired/metadata-error files.

## Completed In Tournament Engine Phase T37

- Added an Evidence Admin Review Dashboard to Risk Ops.
- Grouped recent evidence audit events by evidence file.
- Added review summary cards for:
  - custody exceptions
  - files needing review
  - active legal holds
- Each grouped evidence row now shows:
  - latest event timestamp
  - verdict: `clean`, `review`, or `exception`
  - file name
  - context
  - uploader
  - retention state
  - legal-hold status
  - event count
  - denial count
  - exception count
  - custody review count
- Added direct per-file actions for:
  - chain-of-custody review
  - evidence export package
- Kept the raw Evidence Audit table underneath for deeper operator inspection.

## Tournament Engine Phase T37 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
npm run evidence:retention:check
```

Result: all passed. The retention checker found zero local evidence sidecars and zero expired/metadata-error files.

## Completed In Tournament Engine Phase T38

- Added `EvidenceStorageProvider` as the evidence storage boundary.
- Added the active `local` provider for closed-beta storage under `.data/evidence`.
- Evidence media reads, writes, stats, metadata reads, metadata writes, and metadata listing now route through the provider.
- New hardened evidence sidecars include storage metadata:
  - provider
  - object key
  - metadata object key
- Evidence serving no longer reads local media directly.
- Export packages and custody reviews include storage provider metadata.
- Retention reports now include storage provider status.
- Added `npm run evidence:storage:check` for provider health and retention summary checks.
- Unknown `EVIDENCE_STORAGE_PROVIDER` values fail closed instead of silently falling back.

## Tournament Engine Phase T38 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
npm run evidence:retention:check
npm run evidence:storage:check
```

Result: all passed. The storage provider check reported `local` as the active provider with zero metadata errors.

## Completed In Tournament Engine Phase T39

- Added a quarantine-first cleanup policy for hardened evidence.
- Added local provider quarantine support:
  - active root: `.data/evidence`
  - quarantine root: `.data/evidence-quarantine`
  - media move to quarantine
  - media restore from quarantine
- Added sidecar cleanup metadata:
  - cleanup policy ID
  - active/quarantined status
  - quarantine reason and note
  - operator user ID
  - quarantine timestamp
  - restore operator/timestamp
  - original and quarantine object keys
- Protected evidence serving now returns `410 Gone` for quarantined hardened evidence.
- Export and custody flows can still inspect quarantined media through the provider fallback path.
- Retention reports now include:
  - cleanup-eligible count
  - quarantined count
  - per-file cleanup status
  - quarantine object key
- Added Risk Ops cleanup panels:
  - cleanup/quarantine queue
  - quarantine/restore form
  - cleanup status summary cards
- Added cleanup worker:
  - `npm run evidence:cleanup:check`
  - dry-run by default
  - `-- --apply` quarantines eligible expired files only
- Kept permanent deletion deferred.

## Tournament Engine Phase T39 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
npm run evidence:retention:check
npm run evidence:storage:check
npm run evidence:cleanup:check
```

Result: all passed. The cleanup checker reported dry-run mode with zero eligible files, zero quarantined files, and zero failures.

## Completed In Tournament Engine Phase T40

- Added approval-gated permanent media deletion for hardened evidence.
- Permanent deletion deletes the media object but preserves the sidecar tombstone.
- Deletion prerequisites:
  - hardened evidence file
  - expired retention state
  - no legal hold
  - already quarantined
  - deletion request exists
  - deletion approval exists
  - final confirmation phrase: `DELETE EVIDENCE`
- Added operator separation:
  - request can be created by moderator/admin/owner
  - approval/rejection requires admin/owner
  - approver cannot be the requester
  - final deletion executor must differ from requester and approver
- Added sidecar deletion fields:
  - requested by/at/note
  - approved by/at/note
  - deleted by/at/object key
- Evidence serving now returns `410 Gone` for all non-active cleanup states:
  - quarantined
  - deletion requested
  - deletion approved
  - deleted
- Added Risk Ops deletion controls:
  - request
  - approve
  - reject
  - delete
- Added deletion status summary cards and deletion timing columns to the cleanup queue.
- Added deletion check worker:
  - `npm run evidence:deletion:check`
- Added API audit support for:
  - `deletion_requested`
  - `deletion_approved`
  - `deletion_rejected`
  - `deleted`

## Tournament Engine Phase T40 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
npm run evidence:retention:check
npm run evidence:storage:check
npm run evidence:cleanup:check
npm run evidence:deletion:check
```

Result: all passed. The deletion checker reported zero pending requests, zero approvals, zero deleted media, and zero metadata errors.

## Completed In Tournament Engine Phase T41

- Added final evidence provider migration readiness reporting.
- Added `closed_beta_evidence_provider_migration_v1` readiness contract.
- Added future provider target shapes:
  - S3-compatible storage
  - Cloudflare R2
  - Supabase Storage
- Added migration readiness checks for:
  - active provider status
  - metadata parse failures
  - missing storage metadata
  - missing explicit retention metadata
  - missing cleanup metadata
  - readable active/quarantined media
  - byte-size parity
  - SHA-256 parity
  - legal-hold/deleted-media conflict
- Added provider parity checklist covering:
  - exclusive media writes
  - active media reads
  - quarantined media reads for export/custody
  - sidecar read/write/list
  - object stat
  - quarantine/restore
  - media delete with sidecar tombstone preservation
- Added cutover checklist:
  - freeze cleanup/deletion mutations
  - copy active and quarantined media
  - copy sidecars
  - verify byte size and SHA-256
  - run staging readiness against the target provider
  - switch `EVIDENCE_STORAGE_PROVIDER` only after parity passes
  - keep local backup during the post-cutover audit window
- Added migration worker:
  - `npm run evidence:migration:check`
- Explicitly kept live provider switching out of scope.
- This closes the evidence infrastructure track before returning to tournament launch readiness.

## Tournament Engine Phase T41 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
npm run evidence:retention:check
npm run evidence:storage:check
npm run evidence:cleanup:check
npm run evidence:deletion:check
npm run evidence:migration:check
```

Result: all passed. The migration checker remained available for localhost/provider-change rehearsals, while public launch now expects an external evidence provider with zero critical findings.

## Completed In Tournament Engine Phase T42

- Added web operator QA worker:
  - `src/workers/tournament-operator-qa-check.ts`
  - script: `npm run tournament:operator-qa`
- The web QA gate checks:
  - public tournament board
  - tournament detail and player actions
  - admin tournament command center and admin actions
  - linked match workspace
  - funding, results, settlements, Risk Ops, and notifications routes
  - tournament API bridge coverage
  - evidence legal hold, quarantine, deletion, export, custody, and provider readiness controls
- Added `docs/tournament-end-to-end-operator-qa.md` as the web-side T42 QA source of truth.
- Updated the admin closed-beta guide with the T42 walkthrough and corrected the evidence closed-beta limit now that evidence hardening is complete.

## Tournament Engine Phase T42 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
npm run tournament:operator-qa
```

Result: all passed. The operator QA gate now expects `ready` for public launch, with zero failed checks and zero critical evidence findings.

## Completed In Tournament Engine Phase T43

- Added web closed-beta tournament launch checklist:
  - `docs/tournament-closed-beta-launch-checklist.md`
- Added web launch checklist worker:
  - `src/workers/tournament-launch-checklist.ts`
  - script: `npm run tournament:launch-checklist`
- The web launch checklist verifies:
  - launch verification scripts are registered
  - launch docs exist
  - Product/Ops, Risk/Evidence, Money/Reconciliation, Technical, and Go/No-Go sign-offs are documented
  - launch-critical routes are named
  - evidence launch coverage includes legal hold, chain-of-custody, provider migration, and accepted local-provider warning rules
  - manual money coverage keeps external payment automation disabled and reconciliation explicit
- Updated the admin guide and T42 QA doc to point to the T43 launch checklist.

## Tournament Engine Phase T43 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
npm run tournament:operator-qa
npm run tournament:launch-checklist
```

Result: all passed. The launch checklist now expects `ready` for public launch, backed by an external evidence storage provider.

## Completed In Tournament Engine Phase T44

- Added web live closed-beta tournament dry-run packet:
  - `docs/tournament-live-closed-beta-dry-run.md`
- Added web dry-run checker:
  - `src/workers/tournament-live-dry-run-check.ts`
  - script: `npm run tournament:dry-run-check`
- The dry-run packet documents:
  - dry-run setup rules
  - authenticated browser rehearsal steps
  - launch-critical route coverage
  - lifecycle coverage from tournament creation through settlement/refund gate
  - dry-run transcript template
  - defect recording rules
  - rollback/stop notes
  - exit criteria and no-go conditions
- The checker intentionally returns `ready_for_manual_rehearsal` until an operator completes and records the browser rehearsal.

## Tournament Engine Phase T44 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
npm run tournament:operator-qa
npm run tournament:launch-checklist
npm run tournament:dry-run-check
```

Result: all passed. The dry-run checker returned `ready_for_manual_rehearsal`, with zero failures and one expected warning that the authenticated browser rehearsal still needs to be performed and recorded.

## Completed In Tournament Engine Phase T45

- Added final web tournament handoff:
  - `docs/tournament-final-handoff.md`
- Consolidated the built web scope, source documents, verification commands, closed-beta warnings, manual handoff steps, limits, and stop condition.
- Confirmed the tournament engine phased build is complete.
- Replaced the next-phase instruction with a stop condition: continue only for defect fixes, authenticated dry-run findings, Kora/payment-provider integration after approval, evidence provider migration, or new approved product scope.

## Tournament Engine Phase T45 Verification Run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run launch:check
npm run tournament:operator-qa
npm run tournament:launch-checklist
npm run tournament:dry-run-check
npm run evidence:retention:check
npm run evidence:storage:check
npm run evidence:cleanup:check
npm run evidence:deletion:check
npm run evidence:migration:check
```

Result: all passed. Expected warnings are now limited to manual dry-run rehearsal when operators have not yet completed the authenticated transcript.

## Setup Commands For A Fresh Checkout

```bash
npm install
npm run typecheck
npm run test
npm run evidence:cleanup:check
npm run evidence:deletion:check
npm run evidence:migration:check
npm run evidence:retention:check
npm run evidence:storage:check
npm run launch:check
npm run tournament:operator-qa
npm run tournament:launch-checklist
npm run tournament:dry-run-check
npm run evidence:retention:check
npm run evidence:storage:check
npm run evidence:cleanup:check
npm run evidence:deletion:check
npm run evidence:migration:check
```

## Tournament Engine Track

```text
Tournament engine phased build complete at T45. Continue only for defect fixes, authenticated dry-run findings, Kora/payment-provider integration after approval, evidence provider migration, or new approved product scope.
```

## Community + Virality Track

The Community + Virality track starts after the tournament engine is closed. It should make Skill Rooms public, shareable, and culturally alive without making unsafe payment claims before Kora/payment-provider approval.

## Completed In Community + Virality Phase C1

- Added web community/virality blueprint:
  - `docs/community-virality-blueprint.md`
- Defined public surfaces:
  - share cards
  - tournament highlights
  - winner pages
  - public leaderboards
  - clan/team profiles
  - referral system
  - community announcements
  - livestream/embed support
  - social proof dashboard
- Defined safe social proof before Kora:
  - allowed: matches completed, tournaments hosted, winners crowned, rooms created, disputes resolved
  - cautious: prize reserved, payout queued, refund queued
  - blocked until verified: `NGN X paid out`, `NGN X withdrawn`, `instant payout`, `guaranteed cashout`
- Defined public privacy and moderation rules so public pages do not expose bank details, private evidence, admin notes, unresolved disputes, or hidden risk flags.
- Added C1-C10 roadmap with C2 as the next implementation phase.

## Community + Virality Phase C1 Verification

Documentation-only phase. No code changes were required.

## Completed In Community + Virality Phase C2

- Rebuilt `/community` as a public leaderboard surface while keeping signed-in invite/feed tools available to authenticated users.
- Added filters for game slug, city, campus/community, and region.
- Added public player ranking pages at `/community/players/[userId]`.
- Added public API bridge support that does not require an auth cookie for leaderboard reads.
- Added campus/community to the profile form so campus leaderboards are populated by real profile data.
- Leaderboard UI renders only live API data and shows honest aggregate stats for completed matches, tournaments, tournament wins, and podiums.
- Kept payment wording out of the leaderboard surface until Kora/payment direction is approved.

## Completed In Community + Virality Phase C3

- Added public highlights route:
  - `/community/highlights`
- Added public winner routes:
  - `/community/winners/tournaments/[tournamentId]`
  - `/community/winners/matches/[matchRoomId]`
- Added featured tournament highlight cards to `/community`.
- Wired the web app to new public-safe community APIs for:
  - highlight feed
  - tournament champion pages
  - match winner pages
- Kept public result pages strict:
  - no private evidence links
  - no admin notes
  - no fake payout-completed messaging
  - no static preview cards on real routes
- Public winner pages include share-ready URLs, generated OG/share cards, and links back into ranking/highlights surfaces.

## Completed In Community + Virality Phase C4

- Added site-level `metadataBase` and reusable share-card helpers.
- Added OG metadata for:
  - `/community`
  - `/community/highlights`
  - `/community/players/[userId]`
  - `/community/winners/tournaments/[tournamentId]`
  - `/community/winners/matches/[matchRoomId]`
- Added generated `opengraph-image` routes for:
  - community leaderboard
  - highlights feed
  - leaderboard rank pages
  - public tournament winner pages
  - public room winner pages
- Tournament share cards now ride on the public tournament winner/highlight routes instead of private auth-gated tournament workspace URLs.
- Room share cards now ride on the public match winner routes instead of private room workspace URLs.
- All cards keep payment wording conservative and avoid private evidence/admin data.

## Completed In Community + Virality Phase C5

- Added public clan board at `/community/clans`.
- Added public clan detail pages at `/community/clans/[slug]`.
- Added clan OG/share-card coverage for:
  - `/community/clans`
  - `/community/clans/[slug]`
- Added clan cards to the main `/community` page so public team identity sits beside player rankings and highlights.
- Added captain self-service clan management to `/profile`:
  - clan name/tag
  - region/city/campus
  - visibility
  - game focus
  - description
  - avatar/banner URLs
- Clan pages render only live API data:
  - captain
  - members
  - record
  - reputation
  - clan-linked tournament history
- Empty states stay honest when no public clans or no clan-linked tournament history exists.

## Completed In Community + Virality Phase C6

- Added referral-code-aware registration flow on `/register`.
- Added referral-code pass-through for Google sign-up and preserved referral context when moving between sign-in and register routes.
- Added referral program visibility to `/profile`:
  - personal referral code
  - shareable registration path
  - referral status table
  - non-money reward state summary
- Kept rewards non-cash and progress-based in the UI:
  - setup/activity still pending
  - rewards issued
  - rewards held for moderation review
- The web app renders only live referral data from the authenticated community referral endpoint.

## Completed In Community + Virality Phase C7

- Added public community news routes:
  - `/community/announcements`
  - `/community/announcements/[announcementId]`
- Added announcement cards to `/community` so public platform news and tournament updates are visible alongside highlights and leaderboards.
- Added platform-operator announcement controls on `/admin`:
  - draft or immediate publish
  - maintenance/incident/community categories
  - archive controls for existing notices
- Added tournament-host announcement controls on `/tournaments/[tournamentId]`:
  - creator/co-host/operator update composer
  - draft/publish/archive actions
  - public tournament announcement feed on the event page
- Wired the web app to live announcement APIs only:
  - public announcement feed
  - public announcement detail page
  - manageable announcement lists for operators and tournament hosts
- Kept public messaging honest:
  - published-only public reads
  - no private admin notes
  - no fake winner/payout claims hidden inside news content

## Community + Virality Phase C7 Verification

- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Completed In Community + Virality Phase C8

- Added livestream/watch-link sections to:
  - `/tournaments/[tournamentId]`
  - `/matches/[matchId]`
- Added provider-aware rendering:
  - YouTube can render inline when a safe embed URL is derived
  - Twitch, Facebook, TikTok, Kick, and generic HTTPS links fall back to external watch links when inline embed trust is uncertain
- Added host/operator livestream controls on tournament pages:
  - create official event watch links
  - mark featured streams
  - archive stale links
- Added room-level livestream controls on match pages for:
  - room creators
  - operators
  - linked tournament hosts
- Added authenticated accessible-livestream reads so participant-only links can appear to permitted users without becoming globally visible.

## Community + Virality Phase C8 Verification

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run launch:check`

## Next Instruction

```text
Go ahead with Skill Rooms Community + Virality Engine, Phase C9: Social Proof Dashboard.
```

## Completed In Community + Virality Phase C9

- Added public social-proof page at:
  - `/community/proof`
- Added a live proof summary panel to:
  - `/community`
- Added honest metric rendering from live API state only:
  - matches completed
  - tournaments hosted
  - winners crowned
  - disputes resolved
  - players, clans, and check-ins
- Added truthful money-language panels:
  - prize reservation count and reserved value
  - payout queue count and queued value
  - refund queue count and queued value
- Added explicit locked states for verified payout-completion totals so the UI does not imply completed disbursement before Kora/provider confirmation exists.

## Community + Virality Phase C9 Verification

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run launch:check`

## Completed In Community + Virality Phase C10

- Added a reusable mobile-first public share panel with:
  - native share sheet support where available
  - copy-link flow
  - WhatsApp share intent
  - X/Twitter share intent
- Added the public share panel to high-traffic community pages:
  - `/community`
  - `/community/highlights`
  - `/community/proof`
  - `/community/announcements`
  - `/community/announcements/[announcementId]`
  - public winner pages
- Added missing OG image routes so preview cards stay strong instead of silently degrading on social/chat apps:
  - `/community/proof/opengraph-image`
  - `/community/announcements/opengraph-image`
  - `/community/announcements/[announcementId]/opengraph-image`
- Kept the preview language honest:
  - reserved and queued money language is allowed
  - verified payout completion remains locked until Kora/provider approval exists

## Community + Virality Phase C10 Verification

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run launch:check`
- live smoke for public pages and OG image routes

## Track Status

Community + Virality is complete through C10. New community growth work should begin as a separate planned track.

## Completed In Legal + Product Policy Pack

- Replaced the starter legal pages with a full policy pack driven by shared policy definitions.
- Added a public policy hub at:
  - `/policies`
- Added or upgraded public policy routes for:
  - `/terms`
  - `/rules`
  - `/prizes`
  - `/refunds`
  - `/disputes`
  - `/conduct`
  - `/eligibility`
  - `/privacy`
  - `/compliance`
  - `/trust`
  - `/support`
- Added stronger shared legal-page layout with:
  - updated date
  - related policy navigation
  - pre-launch legal-review notice
- Added documentation:
  - `docs/legal-product-policy-pack.md`
- Established conservative launch policy defaults:
  - 18+ participation stance
  - no betting/casino positioning
  - no completed payout claims before provider-approved reconciliation

## Legal + Product Policy Pack Verification

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run launch:check`
- live smoke for policy routes

## Completed In UI/Auth Polish + Email Readiness Pass

- Changed the shared footer to use the dark hero background instead of a white footer band.
- Tightened mobile footer-link layout and reduced bottom-nav label crowding on narrow screens.
- Reworked the lobby hero CTA stack so:
  - `Community pulse` no longer looks weak on mobile
  - all three hero CTAs stack cleanly on narrow widths
- Hardened Google auth button responsiveness with:
  - width-aware Google button rendering
  - resize-aware rerendering
  - clearer origin-mismatch fallback messaging
- Improved auth page small-screen layout and Google failure messaging.
- Improved profile mobile wrapping for referral and linked-Google surfaces.

## Completed In Auth Trust-Surface Hardening

- Renamed the primary public Google session-completion route to `/api/auth/identity/continue` and Google linking route to `/api/auth/identity/link`.
- Kept temporary compatibility bridges on the old `/api/auth/google` paths while the UI now points only to the neutral identity routes.
- Stopped forcing unauthenticated visitors directly into sign-in from `/`; the home page now introduces Skillsroom publicly before credentials are requested.
- Added stronger pre-auth trust context on sign-in and registration:
  - what the platform is
  - what workflows it controls
  - where to inspect public community, policies, rules, and support pages first
- Reduced the visual emphasis on closed-beta gating language in the auth entry experience so the domain reads more like a real product than a hidden credential wall.

## Auth Trust-Surface Hardening Verification

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- live route verification recommended for `/`, `/sign-in`, `/register`, and the new identity auth routes after deploy

## UI/Auth Polish + Email Readiness Verification

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run launch:check`
- live smoke for `/`, `/sign-in`, `/matches`, `/profile`, `/notifications`

## Completed In Production Evidence Persistence Upgrade

- Replaced the evidence-storage placeholder boundary with real durable provider support.
- Added production-capable providers:
  - `s3_compatible`
  - `cloudflare_r2`
- Kept `local` for localhost development only.
- Public deployments now fail closed if evidence storage remains `local` without an explicit unsafe override.
- Added production env documentation for:
  - bucket
  - region/endpoint
  - access key
  - secret key
  - optional key prefix
  - optional path-style toggle
- Launch check now verifies that public deployments resolve to an external evidence storage provider.
- Funding proof UX now permits either:
  - direct app-hosted upload, or
  - an external proof link when operators need it
- Added reusable pending-submit states across auth, room, and tournament forms so users see immediate action feedback instead of dead clicks.

## Production Evidence Persistence Verification

- `npm install`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run launch:check`
