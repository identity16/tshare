# tshare

A shared home for your team's agent-generated reports — starting with a self-hosted CLI and optional web library.

`tshare` copies a file or directory into a local library and gives it a stable URL. Use it for HTML previews, Markdown reports, PDFs, images, videos, or a folder of work. Re-share the same name to publish a retained revision at the same link. Your source stays untouched.

The current release is single-owner, free, and MIT licensed. Retained versions, feedback threads, CLI/MCP agent access and signed feedback hooks are available. The optional experimental team-access package now implements Google/OIDC login, invitations and sessions; it is not yet connected to team report publishing. Collections remain planned. The team workflow will belong in the open-source Community core; managed hosting and organization administration will be commercial. See [product editions](docs/product-editions.md) and [the roadmap](ROADMAP.md).

**tshare Cloud is not available yet.** [Join the Cloud waitlist](https://tshare-cloud.identity16.chatgpt.site) for a managed team workspace. The agreed pre-launch hypotheses are $9/month Hobby and $29/month Cloud; see [plans and allowances](docs/cloud-plans.md). Cloud hosting is deferred while waitlist demand is collected. The complete landing and waitlist source is in [website/](website/).

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

Shared HTML runs sandboxed and can load only its own files and inline code. Scripts, styles, fonts or media from a CDN are blocked, so `tshare` publishes anyway but warns about them (the MCP `artifact_publish` result carries the same `warnings`). Inline them or publish a rendered copy.

Add `--ui` to opt into the library:

```sh
tshare serve --ui
# Open http://127.0.0.1:8791
```

The library supports search, type filters, sorting, responsive HTML previews, Markdown reading with section navigation, image zoom/pan, video playback and moment links, PDFs, downloads, and direct links. Content and feedback sit beside each other on wide screens and stack on mobile. See [format-specific readers](docs/viewers.md). Version switching and document feedback are included. Browser changes require `TSHARE_PASSWORD`; CLI operations work locally. Display names are unverified under the shared owner password. See [the agent feedback guide](docs/feedback.md).

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

Global flags: `--data-dir`, `--base-url`, `--help`, `--version`. Server flags: `--host`, `--port`, `--ui`, `--feedback`. Agent entry point: `tshare mcp`. Defaults: `127.0.0.1:8791`, data at `~/.local/share/tshare-selfhost`. Environment: `TSHARE_ROOT`, `TSHARE_BASE_URL`, `TSHARE_PASSWORD`, optional `TSHARE_WEBHOOK_SECRET`.

The default library is separate from the original personal `~/.local/share/tshare` script layout. No automatic migration or replacement of an existing `tshare` command is performed; use `node src/cli.js` if that command is already installed.

## Optional team server

The experimental MIT [`server/`](server/README.md) package isolates PostgreSQL and OIDC dependencies from the local CLI. It is runnable behind HTTPS for Google login, email invitations, sessions and member administration. Team report publishing/content delivery are not connected yet. Install and configure it separately; the personal CLI remains unchanged.

## Deployment and development

See [operations](docs/operations.md), [API and storage contract](docs/contracts.md), and [security](SECURITY.md).

```sh
npm test
npm run check
```

Linux and macOS are the initial supported hosts. Docker Compose configuration is included. Storage lives on your host, never in this repository. Back up your library before upgrades. This is an initial release, without a hosted SLA.
