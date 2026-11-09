# Cloud: launch hypothesis, not a released product

Decision date: 2026-11-09. No checkout, payment collection, launch date, or service commitment is offered during the waitlist phase.

## Positioning

tshare is becoming a place for teams to read, review, and reuse agent-generated reports. Community will provide the complete basic team workflow on the user's infrastructure. Cloud will operate that workflow as a managed service. Commercial organization administration is separate from basic collaboration and protection. See [product editions](product-editions.md) for the agreed boundary and [the roadmap](../ROADMAP.md) for availability.

Today, Community is single-owner: a CLI, retained revisions, an optional format-specific web library, document feedback, CLI/MCP access and signed feedback hooks. The optional experimental `server/` implements OIDC, invitations and sessions; team report publishing is not connected. Collections remain planned. Cloud is not available. It is not general-purpose app hosting, a build service, or a replacement for a drive.

## Agreed pre-launch price hypotheses

Accepted on 2026-11-09 as hypotheses to validate through the waitlist, not measured willingness to pay or available subscriptions. Hobby serves individuals and one collaborator; Cloud is the main team offer. Members count together: no separate publisher/viewer role or free-viewer allowance is implied by these plans.

| | Self-hosted | Hobby | Cloud |
| --- | --- | --- | --- |
| Monthly USD price | Free | $9 | $29 |
| Team members | Operator's capacity; no license gate | 2 | 5 |
| Storage | Your hardware | 1 GB | 10 GB |
| Monthly transfer | Your network | 5 GB | 25 GB |
| Host | You | Managed | Managed |
| Availability | Personal CLI/library released; team access experimental | Waitlist | Waitlist |

Hobby retains the same basic secure report workflow: Google/basic OIDC, invitation-based access, document review, versions and agent feedback. These describe the planned complete managed workflow; they do not imply the current access server already publishes or serves team reports. Differentiate the paid plans by capacity rather than withholding basic protection or review. The proposed $79 Growth tier is deferred; do not advertise it as an available or committed offer.

Do not impose artificial capacity or member-count gates on Community. Cloud capacity may have paid usage allowances. Count retained revisions toward storage and all delivered bytes toward transfer. No automatic overage billing: define notification, grace, and pause behavior before launch. Do not offer annual or lifetime plans before measuring retention and costs. Pricing/allowances are not enforced by product code yet.

## Deployment deferred: collect demand first

The user explicitly deferred Cloud hosting on 2026-11-09 until substantially more waitlist interest is collected. Do not provision paid Cloud infrastructure or treat pricing agreement as deployment authorization. The private GCP build/deploy preparation remains reusable, not a live service. Revisit the provider, budget and launch decision after reviewing demand.

No numerical signup threshold is agreed. Separate raw signup volume from real use cases, interest in Hobby versus Cloud, willingness to pay and teams prepared to try the workflow. A large waitlist alone is not a launch decision or evidence of product-market fit.

## What Cloud sells

- Managed availability, upgrades, backups, and monitoring.
- A team workspace without operating the server or configuring a tailnet.
- Organization administration, when implemented and justified by buyers: directory integration, centrally enforced policies, audit and retention, multi-workspace management, and approval workflows. These are separately scoped commercial extensions, not inclusions promised for Hobby or Cloud.

Basic document permissions, local authentication/basic OIDC, comments, versions, collections, MCP, and export belong in Community. Do not make basic secure collaboration the commercial gate.

## Before launch

Measure storage, transfer, requests, backup, abuse handling, and support costs in an invited pilot. No infrastructure margin or paid conversion rate is measured today. Track operator time separately from infrastructure cost.

Validate actual team use and purchase behavior rather than treating waitlist email counts as product-market fit. Initial proposed decision gates are 15–20 qualified buying parties, 5 teams using the real workflow repeatedly, and 3 paying customers. These are operating thresholds, not industry benchmarks. A 10% waitlist-to-paid conversion is an assumption, not a forecast.

## Waitlist data

Keep existing plan values (`cloud`, `team`, `self-hosted`, `unsure`) for continuity. They are legacy interest codes from the older $9 Cloud / $29 Team hypotheses; do not reinterpret historical `cloud` as Hobby or historical `team` as the new Cloud. Before changing the waitlist form to Hobby/Cloud, agree a versioned interest contract and preserve the old records. They record interest at signup, not a contractual plan or willingness to pay; older signups may reflect the previous personal-sharing positioning. Do not rewrite historical answers as team-workspace intent.

Collect email, plan interest, optional use case, consent timestamp/version, source, and registration timestamp. Keep the roster private. No promotional email is sent by the signup endpoint; no automatic follow-up is installed. Preserve duplicate idempotency and the existing private removal-link behavior. The initial retention target remains 12 months unless launch or earlier withdrawal changes it. Confirm the policy and deployment jurisdiction before sending launch messages. Do not collect passwords or payment information.

## Not part of this change

No product team features, commercial extension code, payments, tenant provisioning, new waitlist fields, or storage migration are introduced by this strategy update. Those need their own contracts, implementation, and verification.

## Accepted Cloud architecture direction

The managed multi-tenant direction is recorded in [ADR 0001](adr/0001-managed-multitenant-cloud.md). [Cloud foundation](cloud-foundation.md) separates accepted architectural choices from interfaces still requiring proof. This decision does not launch Cloud or change the existing price hypotheses.
