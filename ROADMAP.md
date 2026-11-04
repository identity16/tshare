# Roadmap

Status: 2026-11-03. This is a direction, not a delivery schedule. Cloud and the team workspace are not available yet.

## Available

- Self-hosted CLI for importing, listing, and deleting artifacts.
- Stable links, immutable retained revisions, and version switching.
- Optional web library with metadata search, filters, and format-specific content tools: video playback/moment links, image zoom/pan, HTML width presets and Markdown section navigation/source/code-copy. Wide screens put review beside the content; mobile stacks it below.
- Document feedback, replies, explicit resolution, CLI/MCP agent access, durable pull and signed webhook notifications.
- Password protection, optional Tailscale routing, and Docker Compose.

## Next: a team report workflow

The goal is one complete loop: an agent publishes a report, teammates read and discuss it, the author publishes a revision, and the team finds the work again later.

1. **Agree the experience.** A working prototype of the library, report reader, document review threads, and revision switching. Use clearly identified sample data.
2. **Publish for a team.** Agree identity and access contracts, invitations and roles, local authentication and basic OIDC, private drafts, retained revisions, and a migration from current snapshot storage. Preserve existing CLI and content links. Implement access tests before claiming team privacy.
3. **Review and reuse.** Document-level comments, replies, resolved threads, revision attribution, collections, and MCP publishing/search/content/review reading. Verify publish → review → update end to end.

Everything in this workflow belongs in Community. Revisions, document review, MCP and feedback hooks now exist for a single owner. Team identity/access, invitations, OIDC and collections still require implementation and contract review. Shared credentials are not a substitute for those controls.

## Planned commercial work

- Cloud: managed operation of the core workflow, backups, updates, and support.
- Organization administration: SAML/SCIM, directory groups, multiple workspaces, audit and retention policies, and approval workflows, as buying needs become clear.
- Commercial self-hosting only if actual buyers require it; no delivery or licensing commitment yet.

## Outside the first team release

Inline annotations, simultaneous editing, arbitrary backend applications, and live data collection. Start with document review and explicit revision publishing. Do not imply a rendered static report is a hosted application or a shared database.

See [product editions](docs/product-editions.md) for the source and commercial boundary, and [runtime contracts](docs/contracts.md) for what works today.

## Cloud foundation

The [managed multi-tenant architecture](docs/adr/0001-managed-multitenant-cloud.md) is the accepted direction. Organization isolation, identity, remote publication and content authentication remain implementation work; [proof gates](docs/cloud-foundation.md) track their contract validation. No hosted Cloud service is available yet.
