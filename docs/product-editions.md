# Product editions

Decision date: 2026-11-03. This is the agreed product boundary, not a list of released features.

tshare is becoming a shared home for agent-generated reports: publish, read, review, update, and find the work again. Community should complete that workflow for a team on its own infrastructure. Cloud sells managed operation; commercial extensions sell organization-wide administration.

## Availability today

The MIT release is a single-owner, self-hosted CLI and optional web library. It supports snapshot imports, stable content links, metadata search, type filters, and HTML, Markdown, PDF, and image viewing. Tailscale is optional. There are no team identities, invitations, comments, retained revisions, collections, OIDC, or MCP tools yet. Re-publishing currently replaces the previous snapshot.

Cloud is a waitlist, not a running service. No commercial extension is released. Keep this distinction in documentation, examples, and marketing.

## Feature ownership

| Area | Community: public MIT core | Commercial boundary: planned |
| --- | --- | --- |
| Publish and read | CLI, optional web UI, report and prototype viewing | Managed hosting, delivery, and service operation |
| Agent access | MCP publishing, search, content reading, and review reading | Organization-managed integrations and credentials |
| Find and organize | Collections and basic search | Administration and search across workspaces |
| Update | Stable links and retained revisions | Organization retention and cleanup policies; managed recovery |
| Review | Document comments, replies, and resolved threads | Approval workflows and review policies |
| People and access | Invitations, basic roles, private drafts, document access controls | Directory groups and organization-wide access policies |
| Authentication | Local authentication and a basic OIDC connection | SAML, SCIM, and centrally enforced authentication policies |
| Data control | Export, deletion, and backup tools | Organization audit trails, retention controls, and administration reports |
| Operation | Self-hosted deployment and maintenance | Managed updates, backups, monitoring, and support |

Basic protection is part of the core, not an upgrade. A team must be able to publish privately, review, retain its work, and export it without a commercial license. Security fixes belong in every affected edition. Do not introduce user-count, document-count, or storage license checks in Community. Physical capacity is the operator's responsibility.

## Source and deployment boundary

- This public repository holds the CLI, server, optional web UI, storage, and future team/MCP core under MIT. Existing published functionality stays public.
- Cloud tenancy, billing, fleet operation, and commercial administration extensions belong in a separate private codebase. Do not put commercial implementation or credentials in this repository.
- Public auth, authorization, content, and revision behavior remain the common core. Commercial code should use that core rather than fork or duplicate its enforcement.
- Add extension interfaces only when an actual implementation needs them. There are no extension packages, licensing framework, or new runtime dependencies in this decision-only change.
- A commercial self-hosted offering is a later option, subject to buyer demand. Offline activation, license expiry behavior, support terms, and packaging are not yet designed or promised.
- CLI-only operation remains supported. Enabling a web UI is optional; team UI work must not make content serving depend on a browser.

## Go-to-market boundary

Community users may remain self-hosted indefinitely. Do not assume a personal Tailscale user will become a Cloud buyer. Cloud is for teams that want the report workflow without operating it; organization features address administration needs beyond a single team.

Keep publisher and viewer pricing separate when testing plans. The existing $9 Cloud and $29 Team prices are early hypotheses, not a validated price for the new team product. See [Cloud plans](cloud-plans.md).

## Release discipline

Use [the roadmap](../ROADMAP.md) to separate released work from planned work. Before implementing team identity, revision storage, or review APIs, agree their contracts and migration behavior. Never label a mockup as a released product screenshot, or a planned control as working access protection.
