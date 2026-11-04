# Throwaway viewer experience study

Question: how should format-specific tools and a shared review conversation fit together?

Run with the existing local CLI (no build or runtime packages):

```sh
tshare share ./web/viewer-prototype viewer-ux-prototype
```

Open the printed content URL, rather than the library's nested viewer. Everything here is synthetic. Comments stay in page memory. This directory belongs only on the prototype branch; it is not imported by the production UI and must not be promoted directly.

Three structurally different arrangements share the same file tools:

- `?variant=A&type=video`: file and review beside one another; recommended for review work. On narrow screens the review follows the content.
- `?variant=B&type=markdown`: full-width file with conversation below; reading takes priority.
- `?variant=C&type=image`: reduced chrome and a large content stage; useful for visual inspection.

The bottom arrows (or keyboard arrows outside interactive fields) switch layouts. Type tabs choose HTML, Markdown, image or video fixtures.

Working prototype interactions: native video playback/seek/speed, a timestamp in the shared URL, a sample timed comment, image zoom/drag/fit/actual pixels, responsive sample-page width presets, Markdown section navigation/source/code copy, and a common sample revision selector/review area. The HTML device-width example uses a responsive synthetic page in the prototype, not a production iframe implementation. The color-bar video is generated with FFmpeg `testsrc2`; the SVG and report are original placeholder fixtures.

Proposed first implementation: these four viewer types, using the existing version and feedback contracts. Infer media behavior from file extension so existing imports do not require a data migration. Add correct video MIME types and retain byte-range support. Use the existing sandbox for real HTML. Do not add inline annotations, structured time/coordinate feedback, media transcoding, third-party viewers, or a schema migration as part of this interface study. PDF, structured data, code and folder-specific tooling remain a separate scope decision.

After selecting a layout, rewrite the chosen behavior in production modules, keep the discarded variations on this branch, and verify the real types, revision links, safe rendering, optional UI and mobile layouts. No personal library content is included in this branch.
