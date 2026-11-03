# v1 contracts

The CLI accepts `tshare <path> [name]`, `share`, `list [--json]`, `rm`, and `serve [--ui]`. Imports are snapshots; reusing a name replaces its contents. Names match `[A-Za-z0-9][A-Za-z0-9._-]{0,95}`. Files and folders are copied; symbolic links are rejected. Storage and source must not overlap.

## HTTP

- `GET /healthz`: `{status:"ok",ui:boolean}`. Contains no content or secrets; available without authentication for container health checks.
- `GET|HEAD /share/:name/…`: content, byte ranges, folder index. HTML imports use `index.html`. File imports retain their original filename. `?download` requests an attachment.
- With `--ui` only: `GET /`, `/app.js`, `/style.css`, and `GET /api/artifacts` returning `{artifacts:[{name,title,description,kind,entry,bytes,created_at}]}`.
- With `--ui` and a password only: `DELETE /api/artifacts/:name`, HTTP Basic auth, `X-Tshare-Request: manage`, and same-origin browser requests. Response `{removed:name}`. No CORS grants.
- All content, UI, and APIs require Basic auth when `TSHARE_PASSWORD` is set. Username `tshare`.
- No remote upload or registration API. Use the CLI on the host or `docker compose exec`.
- The base URL is an origin, without a path prefix. A reverse proxy must forward the original Host header for browser management. `/share` is deliberately not an API or UI asset namespace.

## Storage

Library schema version 1: `library.sqlite` (SQLite WAL mode; `PRAGMA user_version=1`) plus `objects/<uuid>/<copied files>`. The `artifacts` table stores one current object pointer per stable name. Writes copy into a new object, then commit a SQLite transaction. A failed import preserves the previous pointer. Superseded objects are removed after commit. Crashes may leave unused objects but never require them for the active library. Unknown future schema versions are refused.

The storage directory is private to tshare and must not be edited while serving. Do not expose it as a static web root. This format does not import the original macOS shell script's directory tree automatically.
