# Evidence Retention Policy

Skillsroom stores uploaded match-room and tournament proof as private evidence files with JSON sidecar metadata. This policy makes the lifecycle explicit and keeps production storage durable instead of filesystem-dependent.

## Storage Provider Adapter

Evidence storage now goes through the `EvidenceStorageProvider` adapter in `src/lib/evidence-storage-provider.ts`.

Supported providers:

- `local`
  - intended use: localhost development only
  - root: `.data/evidence`
  - quarantine root: `.data/evidence-quarantine`
  - external durability: no
- `s3_compatible`
  - intended use: production or staging durable object storage
  - required envs:
    - `EVIDENCE_S3_BUCKET`
    - `EVIDENCE_S3_REGION`
    - `EVIDENCE_S3_ACCESS_KEY_ID`
    - `EVIDENCE_S3_SECRET_ACCESS_KEY`
  - optional envs:
    - `EVIDENCE_S3_ENDPOINT`
    - `EVIDENCE_S3_PREFIX`
    - `EVIDENCE_S3_FORCE_PATH_STYLE`
- `cloudflare_r2`
  - intended use: production or staging durable object storage
  - required envs:
    - `EVIDENCE_R2_ACCOUNT_ID`
    - `EVIDENCE_R2_BUCKET`
    - `EVIDENCE_R2_ACCESS_KEY_ID`
    - `EVIDENCE_R2_SECRET_ACCESS_KEY`
  - optional envs:
    - `EVIDENCE_R2_PREFIX`
    - `EVIDENCE_R2_FORCE_PATH_STYLE`

Public deployments must not use `local` unless `ALLOW_UNSAFE_LOCAL_EVIDENCE_STORAGE=true` is explicitly set for a controlled non-production exception.

The provider owns file reads, file writes, metadata reads, metadata writes, object stats, and metadata listing. Upload, serving, retention, legal hold, export, and chain-of-custody flows should not read or write evidence media directly.

Unknown `EVIDENCE_STORAGE_PROVIDER` values fail closed so a mistyped future provider cannot silently fall back to local storage.

Run the provider check:

```bash
npm run evidence:storage:check
```

## Provider Migration Readiness

This is the final evidence infrastructure phase before tournament launch readiness work resumes.

The app does not switch providers automatically. Migration readiness only verifies that the current sidecars and media can move to a future external provider.

Supported target shapes for the current provider decision:

- S3-compatible storage
- Cloudflare R2

Future target shape:

- Supabase Storage

Run the readiness checker:

```bash
npm run evidence:migration:check
```

The checker reports:

- active provider status
- retention and cleanup policies
- metadata parse failures
- missing storage metadata
- missing explicit retention or cleanup metadata
- readable media status
- byte-size parity
- SHA-256 parity
- target-provider parity checklist
- cutover checklist

Provider cutover requirements:

- freeze cleanup/deletion mutations during the copy window
- copy active media, quarantined media, and sidecars
- verify byte size and SHA-256 after copy
- run migration readiness against the target provider in staging
- switch `EVIDENCE_STORAGE_PROVIDER` only after staging parity passes
- keep local backup until the post-cutover audit window closes

## Cleanup And Quarantine Policy

Cleanup is quarantine-first. Permanent media deletion is allowed only through the approval workflow.

Quarantine means:

- media is moved out of `.data/evidence`
- sidecar metadata stays in `.data/evidence`
- the sidecar receives `cleanup.status = quarantined`
- protected evidence serving returns `410 Gone`
- export and custody tooling can still inspect the file through the provider fallback path
- operators can restore the file from Risk Ops if quarantine was premature

Eligible automatic cleanup candidates:

- hardened evidence files
- retention state is `expired`
- legal hold is not active
- cleanup status is not already `quarantined`

Metadata-error rows are not automatically moved. They require manual review because malformed sidecars may hide context, uploader, or legal-hold state.

Run the dry-run cleanup checker:

```bash
npm run evidence:cleanup:check
```

Apply quarantine from the worker only after operator approval:

```bash
npm run evidence:cleanup:check -- --apply
```

## Permanent Deletion Approval Workflow

Permanent deletion deletes the media object only. The sidecar remains as a tombstone for reconciliation, audit history, deletion timing, and operator accountability.

Deletion prerequisites:

- hardened evidence file
- retention state is `expired`
- legal hold is not active
- file is already quarantined
- deletion request exists
- deletion approval exists
- final deletion confirmation phrase is typed exactly: `DELETE EVIDENCE`

Operator separation:

- a moderator/admin/owner can request deletion
- an admin/owner must approve or reject deletion
- the approving operator cannot be the requester
- the final deletion executor must be different from both requester and approver

Deletion sidecar states:

- `deletion_requested`
- `deletion_approved`
- `deleted`

Run the deletion queue checker:

```bash
npm run evidence:deletion:check
```

## Current Policy

- Policy ID: `closed_beta_evidence_retention_v1`
- Default retention: 180 days from upload
- Applies to hardened evidence files created by `storeEvidenceFile`
- Applies to match-room proof and tournament proof
- Legacy files without sidecar metadata are treated as `legacy_unclassified`
- Expired hardened files return `410 Gone`
- Legal-hold files remain accessible under the normal evidence access-control rules

## Metadata Contract

New sidecars include:

- `retention.policyId`
- `retention.retentionDays`
- `retention.retainUntil`
- `retention.legalHold`
- `retention.reason`

Older hardened sidecars that do not yet include `retention` are interpreted with the same 180-day policy from `createdAt`.

## Operator Workflow

Run the retention checker:

```bash
npm run evidence:retention:check
```

The retention checker is dry-run only. It prints active, expired, legal-hold, metadata-error, cleanup-eligible, and quarantined counts.

## Legal Hold Workflow

Moderators, admins, and owners can apply or release legal hold from Risk Ops.

Legal hold should be used for:

- active disputes
- abuse investigations
- payout reconciliation
- sponsor or tournament investigation
- regulator-sensitive proof

Legal hold updates are written into the evidence sidecar with:

- hold status
- operator user ID
- hold timestamp
- release operator user ID
- release timestamp
- operator reason

Legal-hold files are not exempt from access control. They remain available only to the normal authorized evidence viewers.

## Export Package Workflow

Support, moderators, admins, and owners can export a hardened evidence package from Risk Ops.

The export package is a JSON manifest, not a raw media bundle. It includes:

- evidence file name
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

The export route records an `exported` evidence audit event after a package is generated.

## Chain-Of-Custody Review

Operators can generate a chain-of-custody review from Risk Ops.

The review produces:

- verdict: `clean`, `review_required`, or `exception`
- integrity findings
- disk-vs-metadata byte-size check
- SHA-256 recomputation check
- retention/legal-hold status
- access denial count
- custody exception count
- export count
- prior chain-review count
- normalized audit timeline

The review route records a `chain_reviewed` audit event after generating the report.

## Quarantine Workflow

Moderators, admins, and owners can quarantine or restore hardened evidence from Risk Ops.

Quarantine should be used for:

- retention cleanup after the retention window expires
- incident containment
- operator investigation
- accidental upload review
- custody exception review

Quarantine and restore updates are written into the evidence sidecar and sent to the API audit trail as:

- `quarantined`
- `restored`

Permanent deletion workflow updates are written into the evidence sidecar and sent to the API audit trail as:

- `deletion_requested`
- `deletion_approved`
- `deletion_rejected`
- `deleted`

## Serving Behavior

When a hardened file is requested:

- metadata is loaded
- file metadata is verified against disk
- retention state is evaluated
- quarantined, deletion-pending, approved-for-deletion, and deleted files return `410 Gone`
- expired files return `410 Gone`
- allowed files include:
  - `x-evidence-retention-state`
  - `x-evidence-retain-until`

All allowed, denied, expired, invalid, missing, and metadata-mismatch attempts are sent to the API evidence audit trail.
