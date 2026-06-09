# Open Risks

Last updated: 2026-06-09

## V3 Product Recovery

The current web experience is not closed-beta quality. It has scaffold-like auth, weak account controls, demo-style copy, uneven mobile responsiveness, and admin pages that do not yet feel like serious operational tools.

Required before closed beta:

- add richer account/session management screen
- remove all user-facing roadmap/preview language
- rebuild player shell and lobby mobile-first
- rebuild admin queues with resilient loading/error/empty states
- verify mobile and desktop screenshots before calling anything launch-ready

## Auth Shape

V3 Phase 2 replaced the visible development sign-in with owned Skill Rooms auth. Admin-sensitive actions now use a password-confirmed, session-bound step-up unlock instead of manual token copy-paste.

Implemented in V3 Phase 3:

- account menu
- role-aware admin entry
- visible logout controls

## Visual Polish

The current UI needs a V3 rebuild, not small polish. Phase 3 primitives are not enough.

Required:

- mobile bottom navigation
- player account sheet
- richer room cards
- better admin decision panels
- upload states
- dispute modals
- settlement confirmation dialogs
- browser screenshot review
- strict overflow checks

## API Contract

Match-room screens now use typed API responses. Profile forms and admin player directory still use preview/default values until their submit workflows are wired.

## Profile Forms

Phase 4 creates the profile surfaces and API contracts, but the web forms still use preview/default values. Later work should wire submit actions to `PUT /profiles/me` and `POST /profiles/me/game-accounts` once local Postgres is available.

## Evidence Upload UX

Evidence capture and file upload are not implemented yet. Phase 7 must handle mobile upload constraints carefully.

## Funding UX

Phase 6 adds funding submission and admin review, but it still relies on an external bank/app check before approval. The product should not imply automated bank confirmation until provider or bank integration exists.

## Admin Player Directory

V3 Phase 6 removes fake player records from the admin player page. A real admin player index API is still needed before this view can show searchable player identity, COD account, reputation, and moderation summaries.

## Evidence Upload UX

Phase 7 uses evidence links and note fields. Native file upload, signed upload URLs, previews, file validation, and private evidence viewing are still future work.

## Result Queue Filters

The admin result page currently loads submitted claims. It should later add tabs for agreed, disputed, approved, rejected, and void flows once operator volume increases.

## Settlement Reconciliation UX

Phase 8 captures payout and refund references manually. Later work should add bank statement reconciliation, duplicate-reference checks, and per-room payout/refund completeness indicators.

## Moderation Enforcement UX

Phase 9 adds moderation controls, but the UI should later surface user moderation status directly in profile, match room, funding, result, and settlement views.

## External Notifications

Phase 10 is in-app only. Email and SMS toggles are stored as preferences, but no external provider sends messages yet.

## Invite Join Flow

Accepting an invite does not auto-join the room yet. The invite response is tracked and visible, while actual room joining remains controlled by the match room flow.

## Tournament Closed Beta Operations

Tournament admin workflow guidance now lives in `docs/tournament-admin-closed-beta-guide.md`, with reconciliation policy in the API runbook. The remaining risk is operational: admins must repeat mobile/browser QA after major tournament UI changes and must follow the manual money checklist before any real payout or refund.
