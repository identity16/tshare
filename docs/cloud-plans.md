# Cloud: launch hypothesis, not a released product

Decision date: 2026-11-03. No checkout, payment collection, launch date, or service commitment is offered during the waitlist phase.

## Positioning

tshare is becoming a place for teams to read, review, and reuse agent-generated reports. Community will provide the complete basic team workflow on the user's infrastructure. Cloud will operate that workflow as a managed service. Commercial organization administration is separate from basic collaboration and protection. See [product editions](product-editions.md) for the agreed boundary and [the roadmap](../ROADMAP.md) for availability.

Today, Community is single-owner: a CLI, stable snapshot links, and an optional web library. Team identity, comments, retained versions, collections, and MCP are not released. Cloud is not available. It is not general-purpose app hosting, a build service, or a replacement for a drive.

## Early price hypotheses

These are the previously proposed USD monthly plans, retained as hypotheses rather than silently presented as settled team pricing. Publisher counts, allowances, and prices must be validated with buyers before launch.

| | Community today | Cloud hypothesis | Team hypothesis |
| --- | --- | --- | --- |
| Monthly price | Free | $9 | $29 |
| Publishers | Single owner | 1 | 5 |
| Storage | Your hardware | 10 GB | 50 GB |
| Monthly transfer | Your network | 50 GB | 250 GB |
| Viewer seats | Your access policy | No viewer charges | No viewer charges |
| Host | You | Managed | Managed |
| Availability | Released | Waitlist | Waitlist |

Do not impose artificial capacity or member-count gates on Community. Cloud capacity may have paid usage allowances. Count retained revisions toward storage and all delivered bytes toward transfer. No automatic overage billing: define notification, grace, and pause behavior before launch. Do not offer annual or lifetime plans before measuring retention and costs.

## What Cloud sells

- Managed availability, upgrades, backups, and monitoring.
- A team workspace without operating the server or configuring a tailnet.
- Organization administration, when implemented and justified by buyers: directory integration, centrally enforced policies, audit and retention, multi-workspace management, and approval workflows. These are separately scoped commercial extensions, not inclusions promised for the $9 or $29 hypotheses.

Basic document permissions, local authentication/basic OIDC, comments, versions, collections, MCP, and export belong in Community. Do not make basic secure collaboration the commercial gate.

## Before launch

Measure storage, transfer, requests, backup, abuse handling, and support costs in an invited pilot. No infrastructure margin or paid conversion rate is measured today. Track operator time separately from infrastructure cost.

Validate actual team use and purchase behavior rather than treating waitlist email counts as product-market fit. Initial proposed decision gates are 15–20 qualified buying parties, 5 teams using the real workflow repeatedly, and 3 paying customers. These are operating thresholds, not industry benchmarks. A 10% waitlist-to-paid conversion is an assumption, not a forecast.

## Waitlist data

Keep existing plan values (`cloud`, `team`, `self-hosted`, `unsure`) for continuity. They record interest at signup, not a contractual plan or willingness to pay; older signups may reflect the previous personal-sharing positioning. Do not rewrite historical answers as team-workspace intent.

Collect email, plan interest, optional use case, consent timestamp/version, source, and registration timestamp. Keep the roster private. No promotional email is sent by the signup endpoint; no automatic follow-up is installed. Preserve duplicate idempotency and the existing private removal-link behavior. The initial retention target remains 12 months unless launch or earlier withdrawal changes it. Confirm the policy and deployment jurisdiction before sending launch messages. Do not collect passwords or payment information.

## Not part of this change

No product team features, commercial extension code, payments, tenant provisioning, new waitlist fields, or storage migration are introduced by this strategy update. Those need their own contracts, implementation, and verification.
