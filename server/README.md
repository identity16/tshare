# Optional team-access server

An experimental MIT server for Google sign-in, invited-email enrollment, revocable sessions and team access administration. It is separate from the dependency-free personal CLI and library. PostgreSQL and OIDC dependencies belong only to this package; the root CLI does not import it.

**This is not yet the complete team report service.** Remote publication, report-content authentication, team review storage and managed Cloud deployment remain subsequent work. No paid infrastructure is created by these commands. The original personal library, password, URLs and local SQLite data are unchanged.

## Install and configure

Requires Node.js 24.16+ and PostgreSQL 16. Install separately:

```sh
npm ci --prefix server
```

Use a dedicated Google OAuth **Web application** client. Configure its redirect URI to the exact `https://YOUR-APPLICATION-ORIGIN/auth/google/callback`; configure consent/audience/test users as applicable. The runtime fixes the issuer to `https://accounts.google.com` and requests only `openid email profile`. It does not call Google APIs or retain provider tokens. See [Google's OIDC setup](https://developers.google.com/identity/openid-connect/openid-connect).

Supply the variables in [.env.example](.env.example) using a secret manager or a private environment file. An `.env` file is not automatically loaded. Keep `CSRF_SECRET` random, at least 32 bytes, stable and identical across instances. Never paste real credentials into a command-line argument, repository, public issue or logs.

Use two database roles: a migration owner and a non-owner runtime login without superuser, `BYPASSRLS`, role/database creation or elevated membership. An operator creates the runtime role first, then runs:

```sh
# Inject MIGRATION_DATABASE_URL and TSHARE_RUNTIME_ROLE privately.
npm run migrate --prefix server
```

Migrations are transactional, serialized and versioned; unsupported future versions are refused. Schema 3 here is unrelated to personal SQLite schema versions. Runtime readiness rejects elevated/table-owning roles. New auth tables have no direct runtime grants: scoped database functions enroll identities, look up sessions and accept invitations. Fixed search paths and explicit function grants are part of the boundary. Authenticated organization work continues through transaction-local `TeamDatabase.withContext` on one checked-out connection.

### First organization and owner

Inject `MIGRATION_DATABASE_URL`, `TSHARE_OWNER_EMAIL`, `TSHARE_OWNER_SUBJECT` and `TSHARE_ORGANIZATION_NAME` privately, then run:

```sh
npm run bootstrap --prefix server
```

The subject must come from an **independently verified Google ID token**, not an email lookup or unverified decoded JWT. The command is an operator action asserting that verified identity. It creates one organization, its Reports workspace and owner; each successful invocation creates a new organization. The HTTP runtime never receives migration credentials and exposes no bootstrap endpoint. Output contains only the created organization UUID. Do not commit actual owner details or customer-specific seeds.

### Run behind HTTPS

With runtime variables injected:

```sh
npm start --prefix server
```

Default internal listener: `127.0.0.1:8792`. TLS terminates at your ingress; the ingress must preserve the configured public Host, reject direct backend access and strip untrusted forwarding headers. The application never trusts forwarded Host/IP headers. Set `HOST=0.0.0.0` only behind such an ingress. Requests whose Host differs from `TSHARE_TEAM_ORIGIN` are rejected. Use a real trusted certificate for normal browsers; no development authentication bypass exists.

`GET /healthz` identifies the listener. Startup verifies DB role/schema and discovers Google endpoints before listening. The listener serves `/login`, `/join`, `/teams`, `/teams/:id` and `/teams/:id/members`; the team page explicitly states that report publishing is not connected yet. UI strings are English.

## Accepted behavior

- Owners register invited emails. The invitee uses `/login`, verifies the exact Google email and explicitly accepts the invitation. No email is sent. Invitations expire after seven days and may be cancelled/reissued.
- Email normalization trims/lowercases only; it does not merge Gmail aliases. Identity is issuer/subject. Another subject claiming an already-linked email fails rather than silently merging accounts.
- A host-only Secure/HttpOnly/SameSite=Lax cookie carries an opaque session token, hashed at rest. Seven-day absolute expiry, no sliding renewal. Login rotates the current browser session; logout revokes it server-side. Other devices are independent.
- Each protected request rechecks active membership. Removing access to one organization does not remove access to another. Replaying an old accepted invitation cannot restore a removed membership. Last-owner removal is refused.
- Writes require exact Origin plus a session-bound HMAC CSRF token. There is no permissive CORS. Session responses are uncached and expose only the caller's teams/invitations. Uploaded code/content is not served by this access server. The [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) informs these checks.
- Per-instance bounded rate limits: 30 login starts, 60 callbacks, 120 writes, 30 writes/user and 1,200 total requests per minute; at most five in-flight browser login cookies. **Deployments must additionally enforce a fleet-wide ingress policy.** Instance counts multiply the per-instance budget; no client-controlled IP headers are trusted.
- Expired rows are logically unusable without a job. Operational retention/cleanup and backups must be agreed before deployment; this increment creates no cron or other recurring infrastructure.

See [the accepted HTTP/storage contract](docs/team-access.md) for endpoints, payloads, permission rules and exclusions. RLS does not protect against a compromised application inventing authenticated identities or issuing arbitrary SQL. This service has not undergone an external security audit.

## Package interfaces

`src/index.js` exports `migrate`, `TeamDatabase`, `PgLoginFlows`, `createOidc`, `AuthenticationError`, `TeamAccess`, `AccessError` and `createTeamServer`. `createOidc` is provider-configurable for protocol tests; the executable runtime uses Google only. Its `begin()`/`complete()` bind state, PKCE and nonce to an HttpOnly per-flow cookie. `complete()` validates signatures/claims and returns identity only; `TeamAccess` controls enrollment and sessions. Never pass an HTTP-supplied identity to `TeamAccess.login`.

The raw pool is infrastructure-only. `TeamDatabase.withContext({organizationId,userId}, callback)` takes server-authenticated IDs, never unchecked headers. Its SQL client stays on one connection through commit/rollback. `withUser` is read-only; `withLoginFlow` scopes pre-login state. Cloud operation, billing and provisioning remain in a private application consuming this public MIT core.

## Verification

```sh
npm test --prefix server
npm run check --prefix server
npm run test:integration --prefix server
```

Unit tests use OpenSSL and a fictional HTTPS provider with signed RS256 tokens. Local integration tests need `initdb`/`pg_ctl` on PATH and a non-root OS account; they create/remove socket-only temporary clusters. CI uses disposable PostgreSQL 16. Integration tests validate a non-superuser migration owner as well as the least-privilege runtime role.

For external integration tests, `TSHARE_TEST_ADMIN_URL` and `TSHARE_TEST_RUNTIME_URL` must identify the same **disposable** `tshare_test` or `tshare_test_*` database. The runtime role must already exist; the test admin needs role creation/database grant rights for the bootstrap proof. **Tests drop the entire `tshare` schema. Never use persistent data.** Files run sequentially.

Browser checks use existing external Playwright/Chrome tooling without adding it to runtime dependencies:

```sh
TSHARE_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
TSHARE_BROWSER_EXECUTABLE=/absolute/path/to/chrome \
npm run test:browser --prefix server
```

Browser fixtures use temporary self-signed HTTPS only in isolated test contexts, real PostgreSQL and the actual application routes. They never modify system certificate trust, hosts files or your existing library. Screenshots and results go to `/tmp/tshare-team-access/latest` (override with `TSHARE_BROWSER_OUTPUT`). The fixture login provider lives under `test-support/`, is never imported by the executable and cannot be enabled by a runtime flag.

Actual Google account sign-in, Safari, Cloud deployment and report publishing are not established by the fictional-provider checks. Report them separately when configured and verified.
