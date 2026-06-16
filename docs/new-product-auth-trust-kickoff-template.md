# New Product Auth Trust Kickoff Template

Last updated: 2026-06-14

Use this prompt at the start of any new product build before serious auth, Google sign-in, or launch-facing routes are implemented.

## Paste-Ready Prompt

```text
Before we build this product, I need you to do an Auth Trust Prevention Review first.

Use the auth trust prevention standard from Skillsroom as the quality bar.

I do not want recovery thinking or "we can fix it later" thinking.
I want prevention thinking from day one so the product never looks deceptive, phishing-like, or like a credential trap.

Review the planned product structure and enforce these rules before implementation:

1. Browser-facing auth routes must be neutral and product-owned, not provider-impersonating.
2. Any risky legacy auth route shape must be disabled explicitly, not left active.
3. The homepage must be publicly understandable before login.
4. Sign-in must be contextual and linked to visible trust surfaces.
5. Public rules, policies, trust, and support pages must exist before launch.
6. Provider identity must be verified properly on the backend.
7. Sessions, cookies, redirects, and cross-origin mutations must be production-safe from the start.
8. No dev-looking auth UX, placeholder auth flows, or weak temporary login behavior.

I want you to:

- inspect the planned architecture first
- identify anything that could create deceptive-pages, phishing, or trust-signal risk
- propose the prevention-safe auth/public-route structure
- state the exact route shape you recommend for browser auth flows
- state which pages must be public before launch
- state what must never be exposed publicly
- then implement only after that review is clean

Important:
- Always prefer long-term quality implementation.
- Do not leave "ready later" auth decisions hidden in the codebase.
- If something should be prevented now instead of recovered later, prevent it now.
```

## Short Version

Use this when you want a more compact kickoff:

```text
Before building, do an Auth Trust Prevention Review using the Skillsroom standard.

I want prevention, not recovery.

Check for:
- neutral browser-facing auth routes
- no provider-impersonating public auth paths
- public homepage before login
- contextual sign-in with trust/support/policy links
- backend provider verification
- hardened cookies, redirects, and cross-origin mutation protection
- no dev-looking or placeholder auth UX

Then propose the safe route/public-page structure first, and only implement after that.
```

## How To Use It

Use this template when:

- starting a brand-new product
- rebuilding auth on an existing product
- adding Google sign-in or another provider
- preparing a product for public launch
- reviewing whether a product feels too login-first or too opaque

## Companion Reference

For the full standard, see:

- `docs/auth-trust-prevention-playbook.md`
