# tshare

Share artifacts across your own devices, over your Tailscale network. Add a web library when you want one.

`tshare` copies a file or directory into a local library and gives it a stable URL. Use it for HTML previews, Markdown reports, PDFs, images, or a folder of work. Re-share the same name to replace the snapshot. Your source stays untouched.

Self-hosted is free and MIT licensed. **tshare Cloud is not available yet.** It is a planned managed service for sharing with other people, without asking them to join your tailnet.

[Join the Cloud waitlist](https://tshare-cloud.tameibis2.chatgpt.site). Proposed plans: Cloud $9/month, Team $29/month, subject to change. The complete landing and waitlist source is in [website/](website/).

## Quick start

Requires Node.js **24.16 or later**. No runtime packages, cloud account, or build step.

```sh
git clone https://github.com/identity16/tshare.git
cd tshare
npm link

tshare ./preview.html preview
# http://127.0.0.1:8791/share/preview/

tshare serve
# Shared URLs work. No web library or management API is enabled.
```

Add `--ui` to opt into the library:

```sh
tshare serve --ui
# Open http://127.0.0.1:8791
```

The library supports search, type filters, sorting, HTML previews, Markdown reading, images, PDFs, downloads, and direct links. Browser deletion requires `TSHARE_PASSWORD`; CLI deletion always works locally.

## Across your own devices

Run the server on your host, then use Tailscale Serve:

```sh
tshare serve --ui
# In another terminal:
tailscale serve --bg http://127.0.0.1:8791
# Use the HTTPS origin printed by Tailscale:
export TSHARE_BASE_URL=https://your-device.your-tailnet.ts.net
tshare ./report.md report
```

Tailscale must be installed and connected on each accessing device. Tailnet access rules determine which devices can reach the service, including subnet-routed networks where configured. tshare itself does not configure routes or ACLs. No Funnel, public tunnel, Tailscale dependency, or automatic launch agent is created. Tailscale is optional; any suitable HTTPS reverse proxy can serve tshare.

**Unauthenticated mode is read-only and intended for trusted devices.** Set `TSHARE_PASSWORD` to protect the entire library and shared content with HTTP Basic authentication (username `tshare`). Use HTTPS remotely. The CLI refuses non-loopback binding without a password.

```sh
# Supply through your secret manager or an untracked environment file.
export TSHARE_PASSWORD='replace-with-a-long-random-password'
tshare serve --ui
```

## CLI

```sh
tshare <file-or-directory> [name] --title 'Review notes' --description 'Draft for Friday'
tshare share ./site my-site
tshare list
tshare list --json
tshare rm my-site
```

Global flags: `--data-dir`, `--base-url`, `--help`, `--version`. Server flags: `--host`, `--port`, `--ui`. Defaults: `127.0.0.1:8791`, data at `~/.local/share/tshare-selfhost`. Environment: `TSHARE_ROOT`, `TSHARE_BASE_URL`, `TSHARE_PASSWORD`.

The default library is separate from the original personal `~/.local/share/tshare` script layout. No automatic migration or replacement of an existing `tshare` command is performed; use `node src/cli.js` if that command is already installed.

## Deployment and development

See [operations](docs/operations.md), [API and storage contract](docs/contracts.md), and [security](SECURITY.md).

```sh
npm test
npm run check
```

Linux and macOS are the initial supported hosts. Docker Compose configuration is included. Storage lives on your host, never in this repository. Back up your library before upgrades. This is an initial release, without a hosted SLA.
