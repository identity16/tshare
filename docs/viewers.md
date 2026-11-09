# Format-specific readers

`serve --ui` opens artifacts in read mode. The header holds the version menu, format-specific tools under **View**, copy link, **More** (original, download and delete), and **Review**. Review opens beside the content on desktop; at 600 CSS pixels or narrower it opens as a bottom sheet with focus kept inside until it is closed. Escape dismisses a menu or review before leaving the reader. The reader remembers an open review panel while switching versions of the same artifact.

Reply and resolution inputs appear only when selected. Open feedback is the default filter; **All activity** also shows resolved threads. Drafts stay in memory with the revision they belong to, with up to 50 revision drafts and 50 thread editors retained per page session. Reloading discards them. An explicit resolution checkbox starts unchecked. Display names remain unverified, and recording a resolution is not approval.

Version links, authentication, storage and feedback keep their existing contracts. This interaction was approved in the [throwaway reader-focus study](https://github.com/identity16/tshare/tree/prototype/reader-focus/design/prototypes/reader-focus); the prototype is not part of the runtime.

| Format | Tools |
| --- | --- |
| Video | Native playback and seeking, 0.5–2× speed, five-second jumps, copy current moment |
| Image | Fit, actual pixel size, zoom, drag or arrow-key pan when zoomed, intrinsic dimensions |
| HTML | 375px phone, 768px tablet or available desktop width; reload the sandboxed preview |
| Markdown | Section navigation, reading/source toggle, code-block copy, headings, flat lists, blockquotes and simple tables |
| PDF | Existing browser-native preview, original and download fallback |
| Folder / other | Existing directory or download fallback |

## Shared links

The CLI publishes and lists links such as `/share/report/?view=1` or `/share/clip/clip.mp4?view=1`. With `--ui`, the artifact entry opens in a lightweight reader: title and displayed version, collapsed **View** tools, **Copy link**, and **More** for original/download. It has no library navigation, review editor or deletion action. These omissions are presentation choices, not new access controls. Authentication and host access remain unchanged.

The current URL selects the latest revision on each open. The content displayed during that open is pinned to the selected immutable revision, including relative HTML assets. Original/download actions use that displayed revision. A video's **Copy this moment** produces a `/share/…?view=1&revision=<id>&t=<seconds>` link, which remains pinned after re-publication. Missing revisions return 404.

Remove `view=1` to get the existing raw response. `?download` always returns the original download, even with `view=1`. With UI disabled, `view=1` is ignored and the content-only server still serves the original bytes. No library, API or viewer resources are exposed in that mode. View applies to the artifact entry; nested resource URLs keep their raw behavior. JavaScript is required for the shared reader, with a no-script explanation of how to open the original.

Reader assets and immutable content use `/share/.tshare/assets/…` and `/share/.tshare/revision/…`. `.tshare` cannot collide with a valid artifact name. These routes let the viewer work when only `/share/` is proxied; it does not fetch the library API or depend on the root origin. Shared HTML keeps its opaque sandbox. PDF rendering remains browser-native, and folders/unsupported files keep their existing preview/download fallbacks.

## Existing libraries

There is no storage migration. Existing `.mp4`, `.m4v`, `.webm`, `.ogv` and `.mov` file snapshots get video tools based on their entry filename. Their stored `kind` remains `file` so CLI/API consumers keep the same contract. The library has a Videos filter. Playback depends on the browser's container and codec support: an unsupported clip offers download, and no transcoding is performed. There is no autoplay; closing or replacing the viewer stops the previous media.

Images start fitted to the available area without upscaling. Actual size is one CSS pixel per image pixel; operating-system display density still applies. Dragging and arrow keys pan a zoomed image within its bounds. At fit size, touch scrolling remains available to move through the reader and review.

HTML presets change an iframe's CSS viewport width. They are layout checks, not device emulation: user agent, touch behavior and browser engine do not change. A preset wider than the available space can be scrolled horizontally inside the preview. The existing opaque sandbox remains in force. Reload reads the selected immutable revision, not a newer publication.

Markdown deliberately supports a small inert subset, rather than all of CommonMark/GFM. Raw HTML, image syntax and links remain plain text. Inline code and bold text are rendered safely; scripts and remote resources are never activated by the reader. Preview is limited to 2 MiB and 20,000 lines; larger documents can be downloaded. Every source code block is copied as its original text, including characters that look like HTML.

## Video moment links

`Copy this moment` copies the **web reader** URL with an explicit revision and seconds:

```text
https://your-device.your-tailnet.ts.net/#item=walkthrough&revision=<revision-id>&t=12.345
```

The actual origin is wherever your library UI is served. For example, a dedicated Tailscale HTTPS port stays in the copied link. Opening it restores that revision and seeks once metadata has loaded; times outside the duration are clamped. Re-publishing the same name does not change what the link shows. The server-side content URL and the ordinary current-artifact link keep their original behavior.

You can paste this URL into a review comment or an agent task. This release does not store structured video annotations or automatically turn a comment into a timed marker. Existing feedback remains document-level and attached to the revision reviewed.

## Verification

`npm test` includes storage/link compatibility, video MIME/range behavior and Markdown parser safety. `npm run check` checks the JavaScript modules without a build step.

The optional browser smoke script uses an existing Playwright installation and a browser executable. It creates its own isolated library, uses only synthetic fixtures, starts its own servers and cleans them up:

```sh
TSHARE_PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
TSHARE_BROWSER_EXECUTABLE=/absolute/path/to/chrome \
node scripts/verify-viewers.mjs
```

These environment variables are for verification only, not runtime requirements. The script checks real playback, revision-pinned moment links after re-publication, media cleanup, image zoom/pan, HTML widths/sandbox, Markdown navigation/source/code-copy and inert content, malformed-video fallback, stale-read cancellation, read-only operation, default read mode, desktop review placement, the mobile sheet and focus/Escape behavior, contextual reply/resolution, revision-scoped drafts, original/download fallbacks and 320–430px overflow checks. PDF verification checks the iframe and fallback actions; native PDF rendering depends on the browser. Screenshots go to the OS temporary directory, or `TSHARE_SCREENSHOT_DIR` when set. The tiny video fixture is generated test-pattern content; no personal artifacts are included.

The shared-link browser check additionally tests a proxy that exposes **only** `/share/`, authenticated resources, HTML relative-asset revision pinning, video moment links after re-publication, file tools, original/download actions, folder fallback and mobile widths of 320, 375 and 430 pixels:

```sh
TSHARE_PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
TSHARE_BROWSER_EXECUTABLE=/absolute/path/to/chrome \
node scripts/verify-shares.mjs
```
