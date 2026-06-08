# Design System

Last updated: 2026-05-27

Skill Rooms V3 should look like a serious competitive gaming operations product that players trust at a glance.

## Product Feel

- Mobile-first for players.
- Dense and decision-focused for admins.
- Competitive, but not childish.
- Trustworthy around money-moving workflows.
- Operational, not casino-like.
- Clear enough that a new player knows the next action within five seconds.

## Palette

- Ink/navy: trust, identity, command surfaces.
- White/off-white: cards, forms, content, tables.
- Teal/green: primary action and success.
- Cyan: active/live states.
- Amber: waiting, funding review, manual checks.
- Red: disputes, failed states, restrictions, risk.
- Slate/neutral: secondary text, dividers, dense admin metadata.

## V3 Token Foundation

Phase 8 moves the product away from scattered styling and into a stricter token base:

- `tokens.color`: background, ink, muted, surfaces, lines, action, status colors, navy, and slate.
- `tokens.spacing`: shared page padding, section gap, card padding, and control height.
- `tokens.radius`: restrained radius scale from `sm` to `xl`.
- `tokens.shadow`: tight, panel, lift, action, and inset shadows.
- `tokens.fontSize`: compact type scale for app surfaces, dashboards, and mobile cards.

Tailwind exposes these as `bg-*`, `text-*`, `shadow-*`, `rounded-*`, `px-page`, `min-h-control`, and the app type scale.

## V3 Primitive Inventory

Phase 8 upgraded or added:

- `Button`
- `Badge`
- `Panel`
- `PanelHeader`
- `StatusPanel`
- `DataTable`
- `EmptyState`
- `SegmentedControl`
- `Skeleton`
- `SkeletonPanel`
- `ErrorState`
- `Tabs`
- `Toast`
- `MobileSheet`

Global loading and error fallbacks now exist for both player and admin routes.

## UI Rules

- App home after login is the lobby, not a landing page.
- Cards are for repeated items, modals, and framed tools.
- Tables, queues, and split decision panels are preferred for admin workflows.
- Status chips must be short and scannable.
- No casino language, no flashy betting visuals, no childish gamer styling.
- Text must not overflow on mobile.
- No internal roadmap language inside the product UI.
- No static preview rows on production routes. Use API data or proper empty states.
- Player screens are designed for phones first.
- Admin screens are designed for laptop/desktop first, with a usable mobile fallback.

## V3 Component Standard

Core components from earlier phases can remain only if upgraded to the V3 standard.

Required V3 components:

- `TopBar`
- `BottomNav`
- `AccountMenu`
- `MobileAccountSheet`
- `RoomCard`
- `RoomStatePill`
- `FundingChecklist`
- `EvidenceChecklist`
- `QueueToolbar`
- `QueueTable`
- `DecisionPanel`
- `StepUpModal`
- `AdminActionDrawer`
- `SessionList`
- `EmptyStateV3`
- `ErrorStateV3`
- `SkeletonBlock`

### Player Shell

- Sticky top bar with brand, account, and context action.
- Bottom navigation on mobile.
- Desktop navigation that does not dominate the page.
- Product identity mark.
- Role-aware admin route only when the user is allowed to see it.
- Account menu with profile, sessions, and sign out.
- Lobby-first experience after login.

### Admin Shell

- Dark command sidebar.
- Top account/role area.
- Dense operational workspace.
- Designed for funding, evidence, dispute, and payout queues.
- Step-up actions happen in focused modals/drawers, not raw token fields.

## Screen Standards

- Lobby must show real room state, join code, create room, and player trust.
- Room detail must show the exact next step for both players.
- Admin overview must show real queues, SLA/age, money exposure, and decision priority.
- Errors must offer retry or explain missing auth/API setup.
- Empty states must explain what happens next without sounding like a placeholder.
- Mobile screenshots must not show cut-off text, horizontal overflow, or unusable tables.

## Banned Product Copy

Do not ship user-facing copy containing:

- "later phases"
- "preview data"
- "placeholder"
- "strict auth bridge"
- "development token"
- "launch check"
- "scaffold"

Use operational language instead:

- "Waiting for both entries"
- "Funding under review"
- "Evidence required"
- "Opponent response pending"
- "Admin decision needed"
- "Payout queued"
- "Refund in progress"
- "Room held for review"
 
