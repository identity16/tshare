# Cloud foundation

Status: architecture direction accepted on 2026-11-04. The interfaces below are **drafts for validation**, not implemented APIs or released team protection. Cloud remains a waitlist.

## What exists

`src/store.js` opens a synchronous SQLite database and copies revisions into `objects/`. `src/schema.js` is schema 2, with one library owner and globally named artifacts. `src/server.js` authenticates one shared Basic password; `src/feedback-http.js` requires it for browser writes. `src/cli.js` publishes host-local paths. There is no remote publishing endpoint, Google login, user membership or tenant boundary today.

The team workflow already includes immutable revisions, document review, CLI/MCP and durable feedback events. Those behaviors should be reused as shared product behavior, with their storage and identity assumptions made explicit.

## Accepted architecture

- Independent cloud account/project and credentials, separate from any pilot customer's production infrastructure.
- One organization per tenant; one initial workspace per organization. A user may have multiple memberships.
- Stateless web/API and a separately dispatched worker. No local durable state inside application containers.
- Managed PostgreSQL: identities, organizations, memberships, artifacts, revisions, feedback, upload sessions, outbox and usage.
- Private object storage: immutable revision files. Object prefixes assist organization; they are not authorization.
- A separate content origin and gateway for active HTML, with sandbox/CSP isolation from the application.
- Managed queue dispatch from a transactional outbox; handlers are idempotent. Queue payloads do not grant tenant access.
- Single region initially, with database connections and instance scaling bounded together. Per-organization resource accounting and limits prevent one team monopolizing shared capacity.

## Identity and organization context — draft

Google OIDC identifies a user using verified issuer/subject and verified email. Only an active membership created from an invited email grants organization access. The email domain alone does not confer access. Revoking membership must invalidate that user's access to the organization; client display names are not the identity source.

Every request selects an organization and verifies membership. Team-owned rows, events and upload sessions include that organization ID. PostgreSQL RLS is a second boundary beyond API authorization, with a non-owner, non-superuser, non-BYPASSRLS application role. Tenant and user settings are transaction-local, never lingering on a pooled connection. Composite references prevent linking one organization's revision or feedback to another's artifact.

The pilot permission baseline is accepted: active members can read, publish and review the organization’s work; only the artifact creator or an organization owner can replace/delete an artifact. Owners manage invitations and membership as well as all artifacts. Invitation/session/token wire formats and the exact identity schema still need concrete interface agreement. A database prototype validating tenant isolation does not establish production Google authentication.

## Publication protocol — draft

1. An authenticated CLI or agent selects an organization and creates an upload session with a manifest: artifact name, entry, relative file paths, sizes and checksums. The server authorizes the action and reserves capacity.
2. The client transfers files to staging object keys using narrowly scoped upload permissions. The client cannot choose another organization's storage prefix.
3. Completion verifies every expected object and the manifest before atomically inserting the immutable revision, updating the stable artifact pointer and recording its outbox event in PostgreSQL.
4. Retrying completion returns the same revision. Concurrent replacement should compare the revision the publisher started from, rather than silently overwriting another publisher's work. Expired incomplete uploads are reclaimed.

Proposed HTTP surfaces for the proof are organization-scoped upload creation and completion, followed by reads/reviews against artifact and revision IDs. Exact paths, wire schemas, limits and conflict codes are not frozen by this document. Personal/local CLI behavior remains unchanged. Agent credentials must be revocable and organization-scoped; no shared owner password is reused for team publishing.

## Content delivery — unresolved proof

The reader URL always checks the viewer's organization/document access. A private object bucket must not become a public website or management origin. HTML, scripts, styles and images need a consistent revision-scoped base path while retaining the existing sandbox.

A signed URL is transferable while valid. An opaque iframe origin and cross-site cookie rules also affect authentication of relative assets. The proof must establish which requests carry credentials in real browsers, whether copied preview capabilities remain usable, and what revocation invalidates. It must not claim Google/allowlist enforcement merely because the original reader required login.

Browser fixture identities, preview grants and test certificates are development fixtures, never production authentication. Production Google integration and Safari behavior must be verified separately.

## Proof gates

- Real PostgreSQL: missing context denies reads; another organization's IDs do not work; composite references reject crossed ownership; read-only membership cannot write; transaction-local context clears on commit; the runtime role cannot bypass RLS.
- Browser/content: authenticated reader, separate content origin, HTML-relative CSS/images, opaque sandbox, outsider access, copied URLs and revoked access.
- Upload: incomplete or mismatched objects cannot publish; retries cannot duplicate revisions; concurrent updates cannot bypass conflict checks; tenant quotas are enforced before finalization.
- Operations: verified backups and restoration, infrastructure estimate, deployment configuration, Google client settings and owner bootstrap before any paid resources are provisioned.

Pilot customer configuration, infrastructure identifiers, email lists and credentials belong only in private operational storage. No actual customer artifacts are used as proof fixtures.

## Verified foundation proofs

Isolated local PostgreSQL 16.15 checks passed for 14 cases, including a non-admin/non-owner application connection, default denial, cross-organization visibility and composite references, own-artifact editing versus owner management, author spoofing, inactive membership, transaction-local context reset, role escalation denial and publication/outbox rollback. These are SQL fixture checks, not a deployed Cloud SQL or integrated API result.

A Chrome HTTPS browser fixture verified separate-origin HTML with relative CSS/images/scripts and an opaque sandbox. A cross-site Lax cookie did not authenticate the iframe. A bearer preview URL remained usable by a different browser while valid. A content-host-only `SameSite=None; Secure; HttpOnly` cookie on a same-site but distinct content origin allowed relative assets while rejecting a copied clean content URL. A one-use, browser-challenge-bound handoff established that cookie; copied handoff codes without the verifier and replayed codes were denied. Membership/session revocation and expiry denied subsequent fixture requests.

The recommended content-session direction therefore uses distinct application and content origins with host-only cookies, not bearer preview URLs as the default recipient-control mechanism. Exact origin layout and handoff are still a draft until the real Google flow and Safari are verified. Same-site deployment also requires strict request-origin/CSRF checks and no parent-domain application cookies; it must not weaken the sandbox or grant uploaded code access to the application origin.

These proofs use fictional identities and temporary servers. They do not verify Google token validation, real invitations, Safari, upload/object-store integration or provisioned Cloud infrastructure.

## Proposed package boundary

Keep the existing root CLI and local server dependency-free. Put the optional shared team server in a separate public MIT `server/` package, with PostgreSQL and OIDC client dependencies scoped to that package. Cloud imports that shared server and adds private provisioning, billing, provider-specific operation and workers. This package/dependency boundary is proposed for approval, not implemented. No runtime or module exports change as part of this document.
