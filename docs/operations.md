# Running tshare

## Native process

Node 24.16+ is required. Run `node src/cli.js` to avoid colliding with a pre-existing personal `tshare` command. No runtime npm installation or build is needed.

Use your host's service manager to keep `node /path/to/tshare/src/cli.js serve [--ui]` running, with a dedicated data directory and untracked environment file. The command stays in the foreground and handles SIGTERM/SIGINT. It does not install a background job for you.

Tailscale Serve proxies the entire origin; preserve the Host header with other proxies. Never proxy the storage directory itself. HTTPS through Tailscale is the primary personal-device deployment. Subnet routes and ACLs are configured in Tailscale, not by tshare.

## Backup and restore

Stop the service and any CLI writes. Copy the entire library directory, including the SQLite database and any WAL/SHM files, and the `objects` directory together. Restore into an empty data directory, then restart. Never copy only the database or only the content. Keep a backup before upgrades; schema v1 refuses newer formats.

Imports are snapshots. Re-sharing the same name replaces the current snapshot and deletes the old one. There is no version history. Interrupted cleanup can leave unreferenced objects; reclaim them only while the service is stopped, after a backup, by comparing `artifacts.object` against directory names. No automatic cleanup job is installed.

## Limits

Imports run on the host and copy recursively. Large copies block that CLI process and need free disk space for both the old and new snapshot until replacement commits. This is a single-owner library, not an object store with quotas. Library lists are returned in full; pagination, multi-user roles, sharing permissions, cloud billing and upload are not implemented. Disk and bandwidth limits in proposed Cloud plans do not apply to self-hosted software.

## Optional UI

`serve` enables only content URLs. `serve --ui` also enables the web library and read API. Browser deletion additionally requires `TSHARE_PASSWORD`; otherwise use `tshare rm`. PDFs use the browser's native preview; use Open original or Download on devices without embedded PDF support.

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
