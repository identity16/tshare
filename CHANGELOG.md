# Changelog

## Unreleased

- Publishing HTML warns about scripts, styles, fonts and media loaded from another origin, which the viewer's CSP blocks. The CLI prints the warning to stderr and the MCP `artifact_publish` result includes `warnings`.

## 0.1.0

Initial single-owner self-hosted release: named snapshots, CLI management, HTTP content serving, optional authenticated web library, and private-network deployment documentation. Cloud is planned and not available.
