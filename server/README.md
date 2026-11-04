# Optional team-server foundation

This MIT package is separate from the dependency-free local CLI at the repository root. It is an experimental foundation, not a released team service or a provisioned Cloud deployment. The existing `tshare` command does not import it.

Install only when working on the team server:

```sh
npm ci --prefix server
npm test --prefix server
npm run check --prefix server
```

PostgreSQL and OpenID Connect libraries are scoped to this package. The root package needs neither them nor a database server to run its existing tests, CLI, or optional personal library.

The initial package boundary covers scoped PostgreSQL transactions/authorization and OIDC protocol validation. Network endpoints, persistent login/session handling, object upload, content authentication and deployment are subsequent contracts; no executable hosted service is exposed by this foundation.

## Package contract

`src/index.js` exports `migrate`, `TeamDatabase`, `PgLoginFlows`, `createOidc` and `AuthenticationError`. These are experimental server-side interfaces. No browser code or local CLI imports them. Dependency versions are pinned in this package's lockfile; the package is not published to npm.

The public MIT package owns shared team behavior. A separate private Cloud application will own provider configuration, tenant provisioning, billing and fleet operation. Customer configuration and credentials must stay outside this repository.

## Database roles and migrations

Use PostgreSQL 16 and two distinct roles: a migration owner and a least-privilege runtime login. An operator creates the runtime role before migration, without superuser, role creation, database creation, table ownership, elevated role memberships or `BYPASSRLS`. Inject credentials through secret storage.

```js
import {migrate, TeamDatabase} from './src/index.js';

await migrate({
  connectionString: process.env.MIGRATION_DATABASE_URL,
  runtimeRole: 'tshare_runtime',
});
const database = await new TeamDatabase({
  connectionString: process.env.RUNTIME_DATABASE_URL,
  max: 5,
}).ready();

// IDs must come from authenticated server context, never unchecked headers.
await database.withContext({organizationId, userId}, async client => {
  return client.query('SELECT id, name FROM tshare.artifacts');
});
await database.close();
```

Migrations are transactional, serialized and versioned. Unsupported future versions fail closed. This PostgreSQL schema does not import or modify the personal SQLite library. Owner/workspace bootstrap and user enrollment are not exposed yet.

Context is transaction-local on one checked-out connection. RLS enforces organization membership and author/owner writes; composite references protect revision ownership. The last active owner cannot be removed. Narrow `SECURITY DEFINER` membership helpers avoid recursive membership policies; their migration owner must never be inherited by the runtime role. Runtime readiness checks reject elevated or table-owning roles. The raw pool is infrastructure-only: request handlers must use the scoped transaction methods. RLS does not protect against a compromised application able to invent authenticated IDs or execute arbitrary SQL.

## OIDC integration requirements

`createOidc` takes HTTPS `issuer` and `redirectUri`, `clientId`, `clientSecret` and a `PgLoginFlows(database)` store. `begin()` returns an authorization URL and a browser binding. The HTTP adapter must store that binding in a host-only, Secure, HttpOnly cookie, then supply it with the exact callback URL to `complete()`. Use separate flow cookies when allowing concurrent sign-in tabs. Neither the binding nor provider tokens should enter page scripts, logs or local storage.

The helper validates PKCE, state, nonce, signed ID tokens, issuer, audience, expiration and verified email. Login flows expire after ten minutes and are consumed once, atomically across instances. Only hashes of the state and browser binding are stored; the PKCE verifier and nonce remain server-side secrets. Token errors are reduced to a generic authentication error. `complete()` returns a verified identity, not a session, invitation acceptance or membership grant. Access and refresh tokens are discarded.

The HTTP layer still needs verified issuer/subject-to-user mapping, invited-email enrollment, revocable sessions, CSRF/Origin checks, rate limiting and expiry cleanup. Email domain alone must never grant access. Private content delivery and uploads remain separate contracts in [Cloud foundation](../docs/cloud-foundation.md). Actual Google sign-in and Safari have not been verified.

## Verification

```sh
npm run test:integration --prefix server
```

Locally, integration tests require PostgreSQL 16 tools (`initdb`, `pg_ctl`) on PATH and a non-root OS account. They create and remove a temporary socket-only cluster. Unit tests require OpenSSL for a temporary HTTPS OIDC fixture. No cloud resources are used.

CI instead supplies `TSHARE_TEST_ADMIN_URL` and `TSHARE_TEST_RUNTIME_URL` for the same disposable PostgreSQL database named `tshare_test` or `tshare_test_*`. The runtime role must already exist. **The test suite drops the entire `tshare` schema in that database. Never point these variables at persistent data.** Integration files run sequentially.

Checks cover pooled context reset, cross-organization denial, author/owner permissions, immutable revisions, publication/outbox rollback, last-owner protection, schema upgrades and concurrent login-flow consumption. OIDC tests use real HTTPS and signed tokens from a fictional local provider; they do not substitute for a deployed Google login test.
