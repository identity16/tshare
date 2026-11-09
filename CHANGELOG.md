# Changelog

## Unreleased

- Published/listed links include `?view=1` for a compact shared reader when UI is enabled, with format-specific tools, copy, original and download actions. Existing raw links and UI-off serving remain compatible; video moment links and displayed HTML assets retain their reviewed revision.

- Artifacts open in read mode, with optional Review beside the document or in a mobile bottom sheet. File tools and versions live in header menus; replies and resolutions expand on demand, and in-memory drafts stay attached to the reviewed revision.

- Publishing HTML warns about scripts, styles, fonts and media loaded from another origin, which the viewer's CSP blocks. The CLI prints the warning to stderr and the MCP `artifact_publish` result includes `warnings`.

## 0.1.0

Initial single-owner self-hosted release: named snapshots, CLI management, HTTP content serving, optional authenticated web library, and private-network deployment documentation. Cloud is planned and not available.
