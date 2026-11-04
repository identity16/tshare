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
