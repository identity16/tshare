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

## Design evidence

Hero shows an actual source snippet and the matching artifact captured from the running self-hosted product. The private route describes Tailscale connectivity; Cloud remains a separate future extension. Screenshots use sample files, not private library contents.

Comparative reviews are expert judgments, not conversion or preference experiments. Early screenshot-only versions scored well on polish but failed the owner's value-communication criterion; the final source-to-device scene addresses that criterion directly.
