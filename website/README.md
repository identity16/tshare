# tshare Cloud waitlist website

English landing and working prelaunch waitlist. The self-hosted product lives at https://github.com/identity16/tshare and works independently of this website.

## Stack and checks

Sites Vinext starter, Cloudflare D1, and static HTML/CSS/JavaScript for the landing. Theme fonts are self-hosted; their OFL licenses are in public/fonts.

npm run install:ci
npm run db:generate
npm run build
npm run dev -- --port 5180

Use the Sites deployment workflow for production. The hosting manifest declares DB; publishing applies the committed Drizzle migration. For local D1, build first, then apply drizzle/0000_lame_runaways.sql using Wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file <migration>.

Checks: node --test test/waitlist.test.ts; npx tsc --noEmit; npm run lint; npm run build.

## Data and access

POST /api/waitlist validates explicit consent and persists email, plan, optional use case, source, and consent metadata. Duplicate addresses preserve their original record. Signup does not send email or charge money.

Each new signup receives a private removal link. Only the token hash is stored. Repeated submissions do not rotate another person's removal link. POST /api/waitlist/remove removes the matching record.

Configure WAITLIST_OWNER_ID as a secret runtime value. /admin requires ChatGPT sign-in and that exact owner ID; /api/waitlist/export returns JSON only to the owner. No public roster endpoint exists. Never commit runtime secrets or database contents.

Cloud is planned, not launched. Displayed prices are hypotheses. No billing, multi-user cloud file hosting, launch date, or SLA is implemented.

## Product positioning and availability

The landing introduces a shared home for agent-generated team reports: read, review, update, and reuse. The released product is still a single-owner CLI and optional library. Team identity, comments, retained revisions, collections, and MCP are planned. Cloud is a waitlist.

The public Community core will include basic team collaboration and protection. Managed operation and organization administration are commercial. The product repository's docs/product-editions.md and ROADMAP.md are the source of truth; the landing must distinguish those plans from released functionality.

Keep existing waitlist plan values and consent behavior. Older signups may reflect personal-sharing intent; do not reclassify them as team buyers. Displayed $9/$29 prices and allowances remain early hypotheses, not final team pricing or promised organization features.

## Design evidence

The hero pairs a real report capture from the self-hosted product with illustrative review text. It is labeled as a planned workspace, not a released team UI. The available-today section uses an actual library capture. All shown artifacts and reviews are samples, not customer evidence.

Retain the existing neutral-black and cobalt brand. Comparative reviews are design judgments, not conversion or preference experiments. Do not add customer metrics, testimonials, or adoption claims without publishable evidence.
