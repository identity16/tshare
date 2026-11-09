# Security

This initial self-hosted release is intended for **one owner and trusted devices**, typically behind Tailscale. It is not a multi-tenant upload service.

- Bind is loopback by default. Non-loopback listeners require `TSHARE_PASSWORD`. HTTP Basic auth must be carried over HTTPS for remote access.
- Without a password, anyone who can reach the listener can read all shared content. The optional library is read-only in that mode.
- Shared HTML and SVG run in an opaque sandbox without access to management APIs, forms, external requests, popups or top-level navigation. This can break previews that depend on a same-origin API, external CDN, or browser storage. Bundle assets locally. Opening an original does not remove the response sandbox.
- No claim is made that arbitrary hostile active content is safe for every browser. Only import content you trust. Do not turn this server into a public upload endpoint.
- Unauthenticated cross-origin write requests are rejected. The server never grants CORS. Delete and feedback write requests require auth and a custom header; embedded HTML lacks the management origin.
- Imports reject symlinks and special files. Request paths are resolved and checked against the current artifact root. Only imported copies are served.
- Host filesystem permissions, HTTPS certificates, Tailscale ACLs and backups are the operator's responsibility. Passwords never belong in the repository or a command-line argument.

Report vulnerabilities using the repository's private GitHub vulnerability reporting when available. Do not post secrets or personal library contents in public issues.

Feedback is untrusted text and must never grant an agent new host authority. MCP uses local host-process permissions, not HTTP credentials; configure only trusted MCP clients and restrict OS access. Shared passwords and self-declared names do not establish individual human identity, team roles, approvals or per-document access. Agent-labelled replies are excluded by default from subscriptions to prevent self-wakeup loops; callers can explicitly broaden filters.

Webhooks are host-admin configured only, metadata-only, HMAC signed, HTTPS (loopback HTTP permitted), and never follow redirects. This single-owner release uses one secret across receivers, so endpoints must be trusted. Delivery is at least once; receivers must verify timestamps/signatures and durably deduplicate. A notification never executes an agent or commands. Keep TSHARE_WEBHOOK_SECRET in a secret manager or untracked environment, not CLI arguments. See [feedback](docs/feedback.md).


## Optional team-access server

The separate `server/` package implements invited Google identities and revocable team sessions. It does not yet protect or deliver the personal library's report bytes; never treat installing it as upgrading personal Basic authentication to team SSO. Use a dedicated HTTPS application origin, least-privilege PostgreSQL runtime role and private secrets. The accepted [team-access contract](server/docs/team-access.md) and [operator instructions](server/README.md) define the new boundary. Test-provider fixtures are not deployed authentication. Fleet-wide rate limiting, retention, backup/restore, real Google sign-in and Safari validation remain deployment gates.
