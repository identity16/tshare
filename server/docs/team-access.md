# Team access — accepted interface

Accepted on 2026-11-09. Prototype evidence: branch `prototype/team-access-contract`, commit `9c87fb6`. The throwaway prototype is not part of this implementation. Customer configuration and credentials remain private.

Question: can invited people enter the correct team, understand denial, and retain access to other teams after one membership is removed?

## Proposed experience and policies

- Google only for this pilot; organizational email domains do not automatically confer access. Keep the shared OIDC module provider-configurable.
- Owners register invited emails. The invitee uses the common login URL, verifies their Google account and explicitly accepts each invitation. No invitation link token or outbound email infrastructure in this increment.
- Invitation lifetime: seven days; owners can cancel or reissue it. Reissuing an active membership is a conflict. Reinviting a removed member requires explicit acceptance and restores their prior membership; existing artifact authorship remains intact.
- Google email must be verified and equal the normalized invited email. Trim/lowercase only; do not merge Gmail dot/plus aliases. Existing identities remain bound to issuer/subject. A different subject presenting an already-linked email requires an explicit recovery process; never silently merge accounts by email.
- After authentication, show pending invitations. With no pending invitations, enter the only active team automatically; otherwise offer a team chooser. A team's deep link enters it directly only after checking membership. No unvalidated return URL is accepted.
- New identities with neither an active membership nor a valid invitation receive a generic invitation-required screen and no application session. Do not disclose team names for arbitrary emails or invite IDs.
- Sessions are opaque random tokens in a host-only `__Host-tshare_session` cookie: Secure, HttpOnly, SameSite=Lax, Path=/, seven-day absolute lifetime, no sliding renewal. Store only token hashes. Login rotates the session; logout revokes the current browser session server-side. Other devices are separate sessions.
- Organization membership is checked for every protected request, not cached as session authority. Removing a member blocks subsequent requests in that team; other organizations remain accessible. Already downloaded content cannot be recalled. Content-origin authorization is a later increment; this access server does not protect any report bytes.
- Last-owner protection already exists. New invitations create members only; owner promotion, account recovery, self-service organization creation and automated email delivery are outside this increment.

## HTTP contract

All endpoints below belong to the optional team server. They do not change existing personal `/api/*`, Basic auth, CLI flags or URLs. IDs below are UUIDs; timestamps are UTC RFC3339 strings. Request bodies are bounded JSON; unknown fields are rejected. Responses use `Cache-Control: no-store`.

| Method and path | Request | Response |
| --- | --- | --- |
| `GET /auth/google/start` | No arbitrary return URL | 303 to provider, per-flow HttpOnly browser-binding cookie |
| `GET /auth/google/callback` | Provider `state`/`code` | Verify OIDC; rotate session; 303 to `/join` or `/teams`. Failure: 303 to `/login?error=sign_in_failed` or `invitation_required` |
| `GET /api/v1/session` | Session cookie | 200 `{user:{id,email,displayName}, organizations:[{id,name,role}], invitations:[{id,organization:{id,name},expiresAt}], csrfToken}`; 401 if absent/expired/revoked |
| `POST /api/v1/logout` | Empty body, CSRF | 204; revoke current session and expire cookie |
| `POST /api/v1/invitations/:invitationId/accept` | Empty body, CSRF | 200 `{organization:{id,name},membership:{role:"member",active:true}}`; email is taken from verified identity, never request body |
| `GET /api/v1/organizations/:organizationId/members` | Session | 200 `{members:[{userId,displayName,role,active}],invitations:[{id,email,status,expiresAt}]}`; owners only |
| `POST /api/v1/organizations/:organizationId/invitations` | `{email}` + CSRF | 201 `{invitation:{id,email,status:"pending",expiresAt}}`; owners only |
| `DELETE /api/v1/organizations/:organizationId/invitations/:invitationId` | CSRF | 204; owners only; cancel pending invitation |
| `DELETE /api/v1/organizations/:organizationId/members/:userId` | CSRF | 204; owners only; deactivate membership, preserve authorship |

Team selection is a URL/UI choice, not a permission-bearing cookie or mutation endpoint. Every future artifact endpoint explicitly includes organization ID and verifies membership. Session responses list only that user's invitations and teams. Sign-in cancellation/failure has a retry action; switching accounts first revokes the current app session and requests provider account selection.

For JSON endpoints: errors are `{error:{code}}`. Codes: 401 `authentication_required`; 403 `membership_required`, `owner_required`, `csrf_failed`; 404 `not_found` for resources outside the caller's authorized scope; 410 `invitation_unavailable` for an authorized invitee's expired/cancelled invitation; 409 `already_member`, `invitation_pending`, `last_owner`; 400 `invalid_request`; 429 `rate_limited`. Invitation acceptance does not reveal someone else's invitation. A repeated acceptance by the same verified identity returns the existing membership, with no duplicate row or restoration of a subsequently removed membership.

All writes require exact trusted Origin and a session-bound `X-CSRF-Token`. No permissive CORS, client-provided identity or raw forwarded-host trust. OIDC callbacks use their browser-bound state/PKCE/nonce checks instead. Concurrent login flows use separate cookies; authentication and invite mutations are rate-limited. Logs exclude session/flow tokens, authorization codes and provider tokens.

## Storage contract

Add migration `0003-team-access.sql` under this accepted contract. Existing personal SQLite is untouched.

| Table/change | Purpose and invariant |
| --- | --- |
| `identities` | UUID ID, user FK, issuer, subject, verified normalized email, timestamps; unique `(issuer,subject)`; pilot uniqueness on normalized email rejects silent account merges |
| `invitations` | UUID ID, organization FK, normalized email, status pending/accepted/revoked, created_by user FK, expires_at, accepted_by nullable user FK, timestamps; one pending invitation per organization/email; expired pending rows must be marked revoked before reissue |
| `sessions` | SHA-256 token hash PK, user FK, created_at, expires_at, revoked_at; no raw cookie or Google access/refresh tokens; CSRF proof derived from a server key and session token |
| Existing memberships | Reuse `(organization_id,user_id)` and `active`; do not delete artifact authorship or copy roles into sessions |

User/identity resolution and first membership acceptance occur before an organization context exists. Implement narrowly scoped database entry points for verified identity enrollment, session lookup and atomic invitation acceptance; the ordinary runtime pool must not gain unrestricted user/session reads or migration credentials. Fixed search paths, explicit grants and concurrent accept/revoke tests are required. Runtime role readiness and migration version checks must advance together.

First organization/owner bootstrap is an explicit operator-only command with credentials from secret storage. No public bootstrap endpoint or customer-specific seed is committed. Bootstrap uses a short-lived, dedicated operational path, not the HTTP runtime role. The operator command is `npm run bootstrap --prefix server`, using privately injected migration credentials and verified Google issuer/subject/email. See the package README.

Expired rows remain logically unusable without a cleanup job. Retention/cleanup must be defined before deployment; this increment does not silently add a cron or new paid resources.

## Implementation sequence

1. Schema and scoped identity/session/invitation primitives; verify with real PostgreSQL, two connections, acceptance/revocation races, rollback and tenant-isolation cases.
2. HTTP OIDC/session/CSRF adapter and operator bootstrap; verify signed-provider fixture end to end, expiry/logout, account conflict and outsider denial. No fixture sign-in endpoint in deployable code.
3. Login/join/chooser/member-admin screens; verify complete browser flows, keyboard/mobile and revoked access, then connect actual Google credentials privately. Actual Google and Safari results are reported separately.

The existing 33 root tests and optional package checks must continue to pass per commit. No uploads, object storage, report-content gateway, billing or cloud provisioning in this increment.
