# Reader focus — provisional UX, not shipped

Scope accepted by user: improve product UX and the demo video in a Linear/Arc-like direction. This branch contains an interaction prototype only. Product/API/storage/authentication are unchanged. Keep the previous video until the screen contract is aligned; then implement fresh production code and recapture the real workflow.

## Job and baseline

Open a report, read it, request a change, inspect another revision, reply and explicitly record a resolution. Source: `web/index.html:9-13`, `web/review.js:19-32`, `web/style.css` viewer/review rules. Existing title, revision selector, content tools and management links each use separate always-visible rows. Every thread exposes a reply form and an open thread exposes another resolution form. Display names are unverified under shared-owner authentication; recording a resolution is not approval.

Preserve: developer/document domain; current `--paper`, `--surface`, `--ink`, `--muted`, `--line`, `--accent`, `--wash`, `--danger`, `--code` and system font; report content/feedback; file tools; link, download, original and deletion actions; revision pinning; explicit resolution intent and unverified identity disclosure; no dependencies. Library, APIs, SQLite, server authentication, installed app and current released video are out of scope for this prototype.

## References inspected

- Linear issue: https://mobbin.com/screens/62c94bcd-0559-4356-9d0e-bce71c021d88 — compact header/actions, content-first issue body, a single comment entry rather than repeated stacked forms.
- Linear discussion: https://mobbin.com/screens/2e6c00de-40a7-455d-875f-0d8cb27c8270 — reply affordance within a comment; flat activity layout.
- Notion discussion: https://mobbin.com/screens/2c1900c8-c7d2-4559-aa5a-4f468674c901 — document beside a compact contextual discussion; reply entry stays with its thread.
- Notion discussions panel: https://mobbin.com/screens/d197acab-453b-4c1b-b46f-87ef523f814d — secondary discussion rail and header actions distinct from the document.
- Arc Browser: not found in two web searches; results named Arcade were not used as Arc evidence. Web target stayed on web. No Arc-specific behavior is claimed.

Take: content area leads, header actions stay compact, secondary discussion lives alongside the content, composer is contextual. Leave: reference logos/data, task/project properties, foreign colors/type and unrelated navigation.

## Moves

| Baseline problem | Move | Evidence / judgement |
| --- | --- | --- |
| Multiple toolbar/title/version rows precede the report | Compact reader header with document title and revision; one menu for secondary original/download/delete actions | Compact header precedent: Linear + Notion. Exact version menu placement/wording is judgement; no claim either reference has tshare's revision model. |
| Review management fills the initial read state | Read by default, Review opens a secondary rail; mobile opens the same rail as a sheet | Document-plus-discussion precedent: Linear + Notion. Default-closed rail and mobile sheet are proposed interaction judgements to approve, not observed Arc behavior. |
| Each comment contains reply and resolution forms even before either action is chosen | Flat readable thread; Reply and Record resolution reveal their own editor on demand | Contextual reply precedent: Linear + Notion. The resolution editor adapts tshare's existing explicit checkbox/message contract. |

New/changed labels: Read, Review, More, Preview size, Add feedback, Reply, Record resolution, Shared owner · names unverified. Original model details remain visible through the appropriate menus. No fake SSO identity, approvals, collections, notification feed or AI execution is added.

Prototype state is fictional and in-memory, never product persistence. Its separate demo controls create/revise sample content and reset the scene; they are not a proposed product feature. No test-provider authentication is implied.

Pending decision: approve the layout, default reading mode and progressive review editors. Do not merge prototype code into main. After approval, implement the real UI against existing APIs, verify all file readers and feedback behavior, and record a new video from that implementation.

The shared static prototype renders only the authored synthetic sample in Shadow DOM, because the installed content server deliberately denies nested frames and outbound connections. This renderer is not a proposed production mechanism. Production must retain its opaque sandbox for arbitrary imported HTML.

## Capture and check results

Captured desktop read/review states at 1600×836 and mobile read/review states at 375×812. Exercised feedback creation, reply, explicit v2 resolution linkage, pinning, open/all filtering, mobile sheet focus and Escape closure. Page errors and horizontal page overflow were absent. The shared static copy also loaded the synthetic report and opened Review with no page/console errors. These are prototype interaction checks, not production authorization or backend tests.

The 20-second motion preview starts directly in the reader, opens the Review panel, adds sample feedback, advances the visibly labelled demo update and records a sample resolution. It has no long opening title card or CLI UUID sequence. H.264, 1920×1080, 30 fps, exactly 20 seconds. It is a UX preview with in-memory data, not a replacement for the actual-product marketing video until the interface is approved and implemented.

Artifacts: comparison.html embeds its own images; before.png/after.png are captured from the actual baseline and proposed interface. Desktop/mobile captures and browser check metadata remain at `/tmp/tshare-reader-focus/latest/`. The sample's reply/resolve editors remain keyboard reachable; the real imported-content sandbox is not changed by this work.
