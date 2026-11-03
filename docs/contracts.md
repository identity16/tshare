# Runtime contracts

The CLI accepts `tshare <path> [name]`, `share`, `list [--json]`, `rm`, `revisions`, `feedback`, `mcp`, `hooks dispatch --once`, and `serve [--ui|--feedback]`. See [feedback interfaces](feedback.md). Imports are snapshots; reusing a name advances its current pointer and retains previous revisions. Names match `[A-Za-z0-9][A-Za-z0-9._-]{0,95}`. Files and folders are copied; symbolic links are rejected. Storage and source must not overlap.

## HTTP

- `GET /healthz`: `{status:"ok",ui:boolean}`. Contains no content or secrets; available without authentication for container health checks.
- `GET|HEAD /share/:name/…`: content, byte ranges, folder index. HTML imports use `index.html`. File imports retain their original filename. `?download` requests an attachment.
- With `--ui` only: `GET /`, `/app.js`, `/review.js`, `/style.css`. With `--ui` or `--feedback`: `GET /api/artifacts` returning `{artifacts:[{name,title,description,kind,entry,bytes,created_at}]}`.
- With `--ui` or `--feedback` and a password only: `DELETE /api/artifacts/:name`, HTTP Basic auth, `X-Tshare-Request: manage`, and same-origin browser requests. Response `{removed:name}`. No CORS grants.
- All content, UI, and APIs require Basic auth when `TSHARE_PASSWORD` is set. Username `tshare`.
- No remote upload or registration API. Use the CLI on the host or `docker compose exec`.
- The base URL is an origin, without a path prefix. A reverse proxy must forward the original Host header for browser management. `/share` is deliberately not an API or UI asset namespace.

## Storage

Library schema version 2: `library.sqlite` (SQLite WAL mode; `PRAGMA user_version=2`) plus `objects/<revision-uuid>/<copied files>`. Artifacts have a stable identity independent of their name and one current pointer. Revisions, feedback threads/replies, metadata events, subscription cursors and webhook deliveries are persisted in SQLite. New events and deliveries commit in the same transaction as their mutation. Copies finish before a revision transaction commits; failure preserves the previous pointer. All prior revisions remain until artifact deletion. Crashes may leave unused objects: only object IDs absent from **all revisions** are orphans. Unknown future schema versions are refused.

Schema 1 migrates automatically with its existing current object as revision 1; previously deleted snapshots cannot be recovered. Back up before opening with this version. Downgrading requires restoring the backup. See [feedback storage semantics](feedback-contract.md).

Historical content is `GET|HEAD /revision/:name/:revision-id/…`; relative assets stay within the version. `?revision=<id>` on a stable share URL redirects to that path. Stable links still open latest; feedback is explicitly attached to the version reviewed.

The storage directory is private to tshare and must not be edited while serving. Do not expose it as a static web root. This format does not import the original macOS shell script's directory tree automatically.
