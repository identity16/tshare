# Security

This initial self-hosted release is intended for **one owner and trusted devices**, typically behind Tailscale. It is not a multi-tenant upload service.

- Bind is loopback by default. Non-loopback listeners require `TSHARE_PASSWORD`. HTTP Basic auth must be carried over HTTPS for remote access.
- Without a password, anyone who can reach the listener can read all shared content. The optional library is read-only in that mode.
- Shared HTML and SVG run in an opaque sandbox without access to management APIs, forms, external requests, popups or top-level navigation. This can break previews that depend on a same-origin API, external CDN, or browser storage. Bundle assets locally. Opening an original does not remove the response sandbox.
- No claim is made that arbitrary hostile active content is safe for every browser. Only import content you trust. Do not turn this server into a public upload endpoint.
- Unauthenticated cross-origin write requests are rejected. The server never grants CORS. Delete requests require auth and a custom header; embedded HTML lacks the management origin.
- Imports reject symlinks and special files. Request paths are resolved and checked against the current artifact root. Only imported copies are served.
- Host filesystem permissions, HTTPS certificates, Tailscale ACLs and backups are the operator's responsibility. Passwords never belong in the repository or a command-line argument.

Report vulnerabilities using the repository's private GitHub vulnerability reporting when available. Do not post secrets or personal library contents in public issues.
