# Format-specific readers

`serve --ui` gives each format its own tools inside one review frame. On screens wider than 1000 CSS pixels, content and document feedback sit beside each other; narrower screens put feedback below the content. Version selection, copy link, download, authentication and feedback use the existing contracts. This is layout A from the [throwaway viewer study](https://github.com/identity16/tshare/tree/prototype/type-viewers/web/viewer-prototype); the variations and sample interactions remain on that branch.

| Format | Tools |
| --- | --- |
| Video | Native playback and seeking, 0.5–2× speed, five-second jumps, copy current moment |
| Image | Fit, actual pixel size, zoom, drag or arrow-key pan when zoomed, intrinsic dimensions |
| HTML | 375px phone, 768px tablet or available desktop width; reload the sandboxed preview |
| Markdown | Section navigation, reading/source toggle, code-block copy, headings, flat lists, blockquotes and simple tables |
| PDF | Existing browser-native preview, original and download fallback |
| Folder / other | Existing directory or download fallback |

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

These environment variables are for verification only, not runtime requirements. The script checks real playback, revision-pinned moment links after re-publication, media cleanup, image zoom/pan, HTML widths/sandbox, Markdown navigation/source/code-copy and inert content, malformed-video fallback, stale-read cancellation, read-only operation, desktop review placement and the mobile layout. Screenshots go to the OS temporary directory, or `TSHARE_SCREENSHOT_DIR` when set. The tiny video fixture is generated test-pattern content; no personal artifacts are included.
