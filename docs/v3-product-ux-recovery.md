# Skill Rooms V3 Product UX Recovery

Last updated: 2026-05-27

## Why V3 Exists

Skill Rooms has a serious backend foundation, but the current web product does not meet the quality bar for a real competitive gaming platform. The UI still feels like a scaffold: weak auth experience, static preview copy, poor mobile polish, oversized typography, incomplete account controls, and admin pages that expose loading failures too bluntly.

V3 is a product recovery track. The goal is to make Skill Rooms feel trustworthy, Nigerian-market aware, mobile-first, and operationally serious from the first screen.

## Product Standard

Skill Rooms should feel like:

- a trusted private match room platform
- a competitive gaming operations product
- a money-sensitive workflow with visible rules and audit trails
- a mobile-first player experience
- a dense but calm admin command center

Skill Rooms should not feel like:

- a betting/casino site
- a demo dashboard
- a Tailwind scaffold
- an internal roadmap exposed to users
- a generic SaaS template

## Immediate Problems To Fix

| Area | Current Problem | V3 Direction |
|---|---|---|
| Auth | Dev role-picker is visible as the main login flow. | Build owned auth like Decide: register, login, refresh sessions, account menu, logout, revoke sessions. |
| Account UX | No proper account menu or sign-out access from the main app shell. | Add avatar menu, mobile account sheet, profile links, session controls, and role-aware admin entry. |
| Copy | Internal notes like "later phases" appear in the product. | Replace with user-facing operational copy only. No roadmap language inside screens. |
| Mobile | Layout overflows, typography is too large, and browser/devtools screenshots show weak constraints. | Rebuild mobile-first using tight cards, bottom nav, stable dimensions, and no horizontal overflow. |
| Lobby | Home is partly static and does not feel like a live room marketplace. | Build a real player lobby with room cards, join code, room status, stake clarity, rules, and trust signals. |
| Admin | Admin pages are visually basic and fail with plain "unable to load" banners. | Build resilient queue pages with filters, diagnostics, retry states, skeletons, empty states, and decision panels. |
| Design | Current design is navy/white/green but not rich or distinctive enough. | Build a sharper identity: clean gaming-operations feel, not casino, not childish. |
| Data | Preview rows are mixed into real pages. | API data or proper empty states only. Demo fixtures belong in story/demo routes, not production surfaces. |

## V3 Product Principles

1. Every screen must answer "what can I do next?"
2. Money-sensitive actions must show status, required proof, and who is responsible.
3. Players should understand room state without reading long explanations.
4. Admins should decide from evidence, history, and risk context in one view.
5. Mobile is the player default; desktop is the admin default.
6. The UI should create trust before asking users to fund anything.
7. Empty states should be useful, not embarrassing.
8. Errors should explain the problem, show recovery, and avoid exposing internal confusion.

## Auth Decision

Skill Rooms will own auth. Do not continue with generic external JWT placeholders as the default production path.

The correct direction is the Decide-style model:

- backend `register`
- backend `login`
- backend `logout`
- access token
- refresh token
- refresh rotation
- session table
- current session tracking
- revoke current session
- revoke other sessions
- web session bridge
- account menu
- role-aware admin entry
- owner/admin/support/moderator roles
- step-up approval flow tied to authenticated admin sessions

Generic `AUTH_JWT_PUBLIC_KEY`, `AUTH_JWT_SHARED_SECRET`, and `AUTH_ISSUER` should only exist as optional future integration knobs, not as the primary Skill Rooms auth strategy.

## Screen Rebuild Targets

### Public / Signed-Out

- Real sign-in page.
- Real create-account page.
- Password reset path.
- Soft product explanation without betting language.
- Clear closed-beta access message.
- No dev-role selector outside local-only tools.

### Player App

- Mobile-first top bar with Skill Rooms identity, account avatar, and primary action.
- Bottom navigation on mobile:
  - Lobby
  - Rooms
  - Activity
  - Wallet/Funding
  - Profile
- Lobby with:
  - join-code panel
  - create-room CTA
  - open rooms
  - rooms awaiting funding
  - rooms under review
  - player reputation/trust block
  - community activity
- Room detail with:
  - room code
  - opponent slot
  - ruleset
  - entry amount
  - funding checklist
  - pre-match evidence checklist
  - result claim
  - opponent response
  - admin review status
  - settlement/refund state
- Profile with:
  - COD Mobile handle
  - verification status
  - reputation
  - disputes/no-shows
  - active sessions
  - sign out

### Admin App

- Desktop command layout with responsive mobile fallback.
- Top-level queues:
  - funding review
  - result review
  - disputes
  - payout queue
  - refunds
  - room holds
  - risk flags
- Queue rows should show:
  - room code
  - players
  - amount
  - current state
  - age/SLA
  - evidence count
  - risk markers
  - next action
- Decision pages should show:
  - room timeline
  - participants
  - payment submissions
  - evidence links/previews
  - opponent response
  - prior risk flags
  - admin notes
  - step-up action modal
- Admin shell should include:
  - account menu
  - current role
  - owner/admin distinction
  - sign out
  - "view player app" link

## Copy Rules

Do not use these in user-facing UI:

- "later phases"
- "preview data"
- "placeholder"
- "strict auth bridge"
- "development token"
- "launch check"
- "scaffold"

Use product language like:

- "Waiting for both entries"
- "Funding under review"
- "Evidence required"
- "Opponent response pending"
- "Admin decision needed"
- "Payout queued"
- "Refund in progress"
- "Room held for review"

## Design Direction

### Visual Feel

- Mature gaming operations, not casino.
- Crisp mobile cards like Decide, but with a competitive match identity.
- Dark surfaces used intentionally for command/navigation, not as heavy page backgrounds everywhere.
- Strong typography, but constrained and responsive.
- Less giant hero copy inside the app; more useful operational surfaces.

### Color Direction

- Ink/navy for trust and command.
- Teal/green for primary action and successful status.
- Cyan for active/live.
- Amber for waiting/manual review.
- Red only for disputes, restrictions, failed states, and risk.
- Neutral surfaces for data density.

### Component Direction

Needed V3 components:

- `AccountMenu`
- `MobileAccountSheet`
- `BottomNav`
- `TopBar`
- `RoomCard`
- `RoomStatePill`
- `FundingChecklist`
- `EvidenceChecklist`
- `DecisionPanel`
- `QueueToolbar`
- `QueueTable`
- `EmptyStateV3`
- `ErrorStateV3`
- `SkeletonBlock`
- `StepUpModal`
- `AdminActionDrawer`
- `SessionList`

## V3 Execution Roadmap

| Phase | Name | Status | Definition Of Done |
|---|---|---:|---|
| V3-1 | Product UX Rewrite + Design Recovery Plan | Done | Recovery blueprint, screen standards, copy rules, auth correction, and V3 roadmap documented. |
| V3-2 | Owned Auth Like Decide | Done | API auth tables/services/routes and web session bridge replace the role-picker flow. |
| V3-3 | App Shell Rebuild | Done | Player top bar, bottom nav, account menu, admin shell, logout, and responsive foundations rebuilt. |
| V3-4 | Player Lobby V3 | Done | Lobby uses live API data or proper empty states; no preview copy; mobile-first room cards. |
| V3-5 | Room Detail V3 | Done | One room page handles funding, evidence, result, timeline, and settlement state clearly. |
| V3-6 | Admin Command Center V3 | Done | Admin queues now use live data, serious review cards, sticky decision panels, and honest empty states. |
| V3-7 | Trust + Reputation Layer | Done | Player trust, verification, dispute history, and moderation status are visible in profile, rooms, community, and admin player review. |
| V3-8 | Design System Upgrade | Done | Token system, primitives, skeletons, loading/error states, tabs, toast surface, and mobile sheet foundation upgraded. |
| V3-9 | Real Data Wiring Cleanup | Done | Real pages use API-backed visible queues/cards or proper empty states; create-room catalog is API-driven. |
| V3-10 | Mobile QA + Responsive Hardening | Next | Screens pass mobile/desktop visual checks with no text overflow or broken layout. |
| V3-11 | Closed Beta Readiness Review | Pending | Real product readiness checklist replaces the previous engineering-only launch check language. |

## Next Instruction

```text
Go ahead with Skill Rooms V3, Phase 10: Mobile QA + Responsive Hardening.
```
