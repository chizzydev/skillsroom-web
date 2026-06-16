# Skillsroom Web

Player lobby and admin operations console for Skillsroom.

## Phase 0 Commands

```bash
npm install
npm run typecheck
npm run test
npm run launch:check
```

## Structure

- `src/app`: routes and layouts.
- `src/components`: app shell and reusable UI.
- `src/lib`: API client, auth bridge, constants, tests.
- `src/styles`: design tokens.
- `docs`: implementation status, UI notes, testing notes, open risks.

## Auth Note

- Google sign-in needs `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- The exact web origin in use, such as `http://localhost:3100` in development or `https://skillsroom.xyz` in production, must also be added to Google Authorized JavaScript origins.
- Search Console URL-prefix verification can use `GOOGLE_SITE_VERIFICATION`. If unset, the production homepage currently falls back to the active Skillsroom verification token.
- Before building a new auth-heavy product, review `docs/auth-trust-prevention-playbook.md`.
- For a paste-ready new chat starter, use `docs/new-product-auth-trust-kickoff-template.md`.

## Evidence Storage

- Localhost development may use `EVIDENCE_STORAGE_PROVIDER=local`.
- Public deployments must use durable object storage:
  - `EVIDENCE_STORAGE_PROVIDER=s3_compatible`, or
  - `EVIDENCE_STORAGE_PROVIDER=cloudflare_r2`
- See `.env.example` for the full storage env set.
