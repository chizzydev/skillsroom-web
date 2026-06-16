# Skillsroom Auth Trust Prevention Playbook

Last updated: 2026-06-14

## Purpose

This is the prevention playbook we should review before building any new product that has login, identity linking, or provider auth.

The goal is simple:

- do not let the public product look like a deceptive credential trap
- do not expose browser-facing auth routes that resemble fake provider endpoints
- do not hide the entire product behind sign-in before users or crawlers understand what the product is

This document is not a recovery checklist. It is the build standard that should keep us from needing recovery in the first place.

## The Core Rule

Public trust must be designed into the product before launch.

If a browser, reviewer, or crawler lands on the site, it should immediately be clear that:

- this is a real product
- the product has a public purpose
- the login is contextual, not the product itself
- the product is not impersonating Google, a bank, or another provider

## The Main Failure Pattern To Avoid

The risky shape is:

1. a mostly hidden or login-first site
2. a public auth screen with little context
3. browser-facing routes named like third-party provider routes
4. unclear ownership, support, rules, or trust pages
5. weak auth hygiene around cookies, origin, and redirects

That shape can make a legitimate product look suspicious even when the backend logic is technically correct.

## Build Standard

### 1. Keep browser-facing auth routes neutral

Use product-owned route names for browser flows.

Good examples:

- `/api/auth/identity/continue`
- `/api/auth/identity/link`
- `/sign-in`
- `/register`

Avoid public route names like:

- `/api/auth/google`
- `/api/auth/google/link`
- `/google/login`
- `/oauth/google/callback` as the primary browser entry if it is directly user-visible

Why:

- neutral naming makes it obvious that the product is completing its own identity flow
- it avoids looking like a fake provider login page
- it separates "provider integration" from "browser-facing product route"

### 2. Disable legacy suspicious routes explicitly

If older routes with provider-looking names ever existed, do not leave them live.

They should return a clear inert response such as `410 Gone` with a message pointing to the neutral replacement path.

Why:

- dead legacy stubs are safer than forgotten active routes
- scanners and reviewers should see that those paths are intentionally retired

### 3. Make the homepage public and product-first

The homepage should explain the product before login is required.

It should show:

- what the product is
- who it is for
- what users do there
- what happens before and after sign-in
- visible links to public rules, policies, trust, and support

Avoid making sign-in the first meaningful public experience unless the product absolutely requires invite-only access and still has a clear public explanation page.

### 4. Make sign-in a trust surface, not a dead-end wall

The sign-in page should contain:

- short product explanation
- why sign-in is needed
- visible links to public rules, policies, support, and community
- graceful fallback if Google or another provider is unavailable
- honest error messages

It should not feel like:

- "enter credentials first, ask questions later"

### 5. Keep public trust surfaces visible before auth

At minimum, public navigation or footer access should exist for:

- policies
- rules
- prizes or payouts policy
- disputes
- trust or safety
- terms
- privacy
- support
- community or proof of legitimate activity where appropriate

These pages do not need to reveal sensitive business details. They need to prove the product is real and accountable.

### 6. Verify third-party identity properly on the backend

Provider identity must be verified server-side.

For Google-style flows:

- accept the provider credential or ID token
- verify signature against provider keys
- enforce the exact client ID audience
- enforce the allowed issuer
- require the fields your auth model depends on

Do not trust browser-side claims without backend verification.

### 7. Treat cookies and session boundaries seriously

Production session cookies should be:

- `httpOnly`
- `secure`
- `sameSite=lax` or stricter where appropriate
- scoped intentionally
- rotated or refreshed through controlled server flows

Do not expose access tokens into unnecessary browser code just to make auth easier to wire.

### 8. Block cross-origin mutations

All mutating web routes should enforce same-origin expectations through `Origin` and/or `Referer` checks where appropriate.

Why:

- prevents unauthorized cross-site form posts
- reduces the chance of auth flows looking unsafe or being abused

### 9. Be careful with redirects

Redirects after sign-in should be:

- relative or allowlisted
- normalized
- validated

Do not allow open redirect behavior.

### 10. Never ship "temporary-looking" auth UX

Avoid:

- dev role pickers
- visible fake admin switches
- generic placeholder login copy
- buttons that silently fail
- provider auth that works only after manual operator intervention

Even if temporary, these things make the product look less legitimate.

## Skillsroom Lessons

These were the prevention-aligned changes that gave Skillsroom a safer public posture:

- browser-facing Google completion moved to neutral identity routes
- legacy `/api/auth/google` style browser paths were disabled
- homepage became publicly accessible and explanatory before login
- sign-in became contextual with trust links and product explanation
- public community, policy, rules, and support surfaces were made visible
- session cookies and auth bridge behavior were hardened
- cross-origin mutation checks were enforced

## What This Means In Practice

Before we build a new product, we should ask:

1. If a stranger lands on the homepage, do they understand the product without logging in?
2. If they land on the sign-in page directly, does it still look like a real product and not a credential trap?
3. Are browser-facing auth routes named after our identity flow, not after the third-party provider?
4. Are any legacy provider-looking routes still active?
5. Are public rules, support, and trust pages visible before auth?
6. Are redirects, cookies, and cross-origin mutations locked down?

If any answer is no, we should stop and fix it before launch.

## What Not To Rely On

These are useful after a problem happens, but they are not prevention:

- Google Search Console verification
- Safe Browsing report forms
- manual review requests
- explanations sent after the warning already exists

Those are escalation tools, not product design strategy.

## Pre-Launch Gate

Before launch, verify all of the following:

- homepage is public and product-explanatory
- sign-in is contextual and links to trust surfaces
- no browser-facing provider-impersonating route names are active
- old risky auth routes return inert responses
- auth cookies are production-hardened
- cross-origin mutation checks are active
- redirects are allowlisted or normalized
- provider credentials are verified server-side
- footer or public nav exposes trust, policy, and support pages

If this list is not complete, the product is not ready for public auth traffic.
