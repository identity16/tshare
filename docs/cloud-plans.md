# Cloud: launch hypothesis, not a released product

Decision date: 2026-11-03. Prices are USD per month, proposed and subject to change. No checkout, payment collection, launch date, or service commitment is offered during the waitlist phase.

## Positioning

Self-hosted tshare is a single-owner tool for artifacts across personal devices and networks over Tailscale. It stays free, MIT licensed, and usable without a web UI. No feature gating, license checks, or artificial storage/bandwidth quotas are added to self-hosted software.

Cloud is planned for sharing with other people: reachable links without tailnet onboarding, managed availability, and publisher workspaces. Guests should not pay to view. The product is artifact delivery and viewing, not general-purpose app hosting, a build service, or a replacement for a drive.

## Proposed plans

| | Self-hosted | Cloud | Team |
|---|---|---|---|
| Monthly price | Free | $9 | $29 |
| Publishers | Single owner | 1 | 5 |
| Storage | Your hardware | 10 GB | 50 GB |
| Monthly transfer | Your network | 50 GB | 250 GB |
| Guest viewers | Your access policy | No viewer seats | No viewer seats |
| Host | You | Managed | Managed |
| Availability | Open-source release | Waitlist | Waitlist |

Cloud capacity is a monthly usage allowance, not a promise of unlimited requests or availability. Count all stored snapshots toward storage and all delivered bytes, including previews and downloads, toward transfer. No automatic overage billing. Notify before the limit and ask for an explicit upgrade; define pause/grace behavior before launch so existing links do not disappear unexpectedly. No annual or lifetime plan until retention and unit economics are measured.

## Why these prices

- Tiiny Host's public page lists annual-equivalent $5 Tiny, $13 Solo, $31 Pro and project/storage/bandwidth limits. Its help page lists monthly Tiny $9, Solo $18, Pro $38. The help table's Solo annual row is inconsistent; use the pricing page or checkout rather than deriving numbers from that row. https://tiiny.host/pricing and https://helpdesk.tiiny.host/en/article/pricing-plans-1i3vkky/
- Netlify lists a Personal tier and a flat Pro tier with unlimited members, free reviewer roles, and metered usage. It is an adjacent deployment product rather than a direct substitute. https://www.netlify.com/pricing/

Inference: $9 is a testable low-friction entry for an individual who shares with guests; $29 tests a workspace purchase without per-viewer charges. Those are hypotheses, not validated willingness to pay. Do not claim a discount against competitors whose billing periods and features differ.

## Before launch

Measure actual storage byte-months, transfer, request counts, backup, abuse handling, and support cost on a small invited pilot. A proposed gate is at least 70% gross margin after infrastructure and payment fees, assessed per plan and at the 95th percentile of pilot usage; operator time must be tracked separately. Raise prices or reduce included capacity if this fails. No cost or margin is currently measured.

A proposed launch signal is 50 qualified Cloud/Team signups, at least 10 responses with a concrete repeated sharing need, and 5 people explicitly willing to pay the displayed price. These are operating decision thresholds, not industry benchmarks. Do not equate raw email count with demand.

## Waitlist data and review

Collect email, plan interest, optional use case, consent timestamp/version, source, and registration timestamp. Store privately; never return the roster from a public endpoint or publish data in git. No promotional email is sent by the signup endpoint. Keep duplicate submissions idempotent without disclosing registration status. No automatic follow-up schedule is installed.

Review counts by plan and use case weekly when requested. Start with an owner-only export or read view, not a public dashboard. Provide deletion and withdrawal, and remove waitlist data when it is no longer needed; the initial retention target is 12 months unless launch or earlier withdrawal changes it. Confirm the policy and deployment jurisdiction before sending launch messages. Do not collect passwords or payment information.

Not included in this release: multi-tenant storage, public uploads, invitation/guest ACLs, link password/expiry, billing, custom domains, audit logs, version retention, SLAs or SSO. Those require explicit design before a Cloud pilot.
