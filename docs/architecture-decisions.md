# Architecture Decisions

## ADR-001: Web Consumes API Authority

Decision: the web app does not own match, ledger, or settlement logic. It calls `skill-rooms-api`.

Why:

- Keeps financial and match lifecycle logic on one backend authority.
- Makes future mobile apps easier.
- Prevents Next route handlers from becoming a hidden backend.

## ADR-002: App-First Player Experience

Decision: the first screen is a lobby/workspace preview, not a marketing landing page.

Why:

- This is a product users return to repeatedly.
- Player speed matters more than brand storytelling after signup.

## ADR-003: Token-Driven UI

Decision: colors, radius, and shadow decisions live in `src/styles/tokens.ts` and Tailwind config.

Why:

- Prevents inconsistent styling.
- Keeps the product from drifting into an unserious visual system.
