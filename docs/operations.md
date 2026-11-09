# Running tshare

## Native process

Node 24.16+ is required. Run `node src/cli.js` to avoid colliding with a pre-existing personal `tshare` command. No runtime npm installation or build is needed.

Use your host's service manager to keep `node /path/to/tshare/src/cli.js serve [--ui]` running, with a dedicated data directory and untracked environment file. The command stays in the foreground and handles SIGTERM/SIGINT. It does not install a background job for you.

Tailscale Serve proxies the entire origin; preserve the Host header with other proxies. Never proxy the storage directory itself. HTTPS through Tailscale is the primary personal-device deployment. Subnet routes and ACLs are configured in Tailscale, not by tshare.

## Backup and restore

Stop the service and any CLI writes. Copy the entire library directory, including the SQLite database and any WAL/SHM files, and the `objects` directory together. Restore into an empty data directory, then restart. Never copy only the database or only the content. Keep a backup before upgrades; schema 2 refuses newer formats. Opening a schema 1 library migrates it automatically; restore your pre-upgrade backup to downgrade.

Imports are immutable revisions. Re-sharing the same name advances its current pointer while retaining every prior revision. Existing schema 1 contents become revision 1; already discarded history cannot be recovered. `rm` deletes all revisions, feedback and related notifications. Interrupted cleanup can leave unreferenced objects; reclaim them only while the service is stopped, after a backup, by comparing **all `revisions.id` values** against directory names (not just current `artifacts.object` pointers). No automatic cleanup job is installed.

## Limits

Imports run on the host and copy recursively. Large copies block that CLI process and need free disk space for every retained revision, plus the new copy. This is a single-owner library, not an object store with quotas. Library lists are returned in full; pagination, multi-user roles, sharing permissions, cloud billing and upload are not implemented. Disk and bandwidth limits in proposed Cloud plans do not apply to self-hosted software.

## Optional UI

`serve` enables only content URLs. `serve --ui` also enables the web library, feedback and revision APIs. `serve --feedback` enables the APIs without UI. CLI output links use `?view=1` for the shared reader when `--ui` is enabled; otherwise they serve the original. A proxy mounting only `/share/` must forward the whole subtree, including `/share/.tshare/`.

Browser writes additionally require `TSHARE_PASSWORD`; otherwise use `tshare rm`. PDFs use the browser's native preview; use Open original or Download on devices without embedded PDF support.

## Docker Compose

```sh
cp .env.example .env
# Edit .env with a long random password and your Tailscale HTTPS origin.
mkdir -p inbox
cp /path/to/preview.html inbox/
docker compose up -d --build
docker compose exec tshare node src/cli.js /inbox/preview.html preview
```

Uncomment the `command` line in `compose.yaml` and run `docker compose up -d` to enable the web UI. Disable it again by removing that override. Both modes share the same volume. The exposed host port remains loopback-only; proxy it with Tailscale Serve on the host.

The image runs as the unprivileged `node` user. Docker named volumes initialize with the image's data directory ownership. For a bind mount, grant UID 1000 write access before starting. Sources in `inbox` must be readable by that user. The source mount is read-only. This image runs the server and CLI together, but web UI activation is optional. Do not publish the container port directly to the internet.

`docker compose down` preserves the library volume. Removing that volume destroys shared snapshots. To back up, stop the service and copy the complete volume using your normal Docker volume backup process.

## Feedback workers

See [the runner and webhook guide](feedback.md). A configured `TSHARE_WEBHOOK_SECRET` enables the foreground dispatcher in `--ui` or `--feedback` mode. Stop workers before a backup. Pending deliveries and consumer cursors are part of the database backup. Restoring an older backup can re-deliver already processed events: receivers must deduplicate durably. Protect backups like artifact contents, since they include reviews and webhook endpoint metadata.
