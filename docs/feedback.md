# Close the report feedback loop

Community includes retained revisions, document feedback, CLI/MCP agent access, durable pull consumers and signed webhook notifications. It still uses a **single shared owner password**: authors and human/agent labels are self-declared. This is not team SSO, per-document permissions or an approval system.

## Read and review

```sh
# Supply TSHARE_PASSWORD from your secret manager or untracked environment.
tshare ./report.html report
tshare serve --ui
```

Open the library, choose a report and scroll below it. Choose Question, Suggestion, Change request or Decision; post against the displayed version. Reply in the same thread. To resolve, explain the outcome or explicitly check the displayed revision. Recording a decision or resolution does not grant agent permission or prove human approval. Refresh feedback to see changes from another process; this release does not live-push UI updates.

A report stays pinned to the version opened until you refresh or choose another version. Re-publishing preserves its stable `/share/report/` link while retaining all prior versions. Version-specific content uses `/revision/report/<revision-id>/…`, so relative images and styles stay in that version too. In the library, `#item=report&revision=<revision-id>` shares the reader at a specific version. Removing an artifact removes all versions, threads, associated events and pending notifications.

No browser is required: `serve --feedback` exposes the API without UI; bare `serve` exposes only content. Local CLI and MCP access do not require either server mode.

## CLI runner

```sh
# On the host, before asking for review. Consumer defaults to FUTURE human feedback.
tshare feedback subscribe report-agent --artifact report

# A person can also post without the UI. --revision is optional here and defaults
# to the current version at invocation. Use an explicit ID when reviewing an older copy.
tshare feedback add report --kind change_request --message 'Explain the assumptions.'

tshare feedback poll report-agent --json
# Read every returned feedbackId in full before acting:
tshare feedback get <feedback-id>
tshare feedback reply <feedback-id> --actor agent --message 'I will clarify them.'

# Edit your source with your normal agent, then publish explicitly:
tshare ./report.html report --actor agent
tshare revisions report
# Use the revision ID just published, not an inferred "latest" value:
tshare feedback resolve <feedback-id> --actor agent --revision <revision-id> --message 'Added the assumptions.'

# Only after processing the batch, acknowledge the poll response's nextCursor:
tshare feedback ack report-agent <nextCursor>
```

An agent reply does not wake its own default consumer. `--kinds question,change_request` narrows kinds; `--types feedback.created,feedback.replied` narrows event types; `--actors human,agent` explicitly includes agent events. To observe revisions include `artifact.revised` and the desired actors. Subscriptions start at the latest event; `--after 0` replays retained history. `--limit` is 1–200. Poll is repeatable until ack, including across restarts. One name is one logical consumer; use different names for independent agents. Configuration cannot silently change: unsubscribe and register again, with an explicit replay cursor if needed.

Pull acknowledgement is monotonic and trusts the caller. Do not acknowledge beyond events you have handled. Mutation commands are not idempotent: retrying add/reply after an uncertain outcome can duplicate comments. Inspect the thread before retrying.

## MCP stdio

Configure your client's stdio server command as `node`, with arguments:

```json
["/absolute/path/to/tshare/src/cli.js", "mcp", "--data-dir", "/absolute/path/to/library"]
```

Use `artifacts_list` (optional `query`), `artifact_publish`, `artifact_revisions`, `artifact_read`, `feedback_list`, `feedback_get`, `feedback_add`, `feedback_reply`, `feedback_resolve`, `feedback_subscribe`, `feedback_poll`, `feedback_ack`, and `feedback_unsubscribe`. The server exposes input schemas through `tools/list`. Add feedback with an explicit `revisionId`; resolve with a message or explicit revision ID. MCP mutations are always labelled agent-authored. Reading returns at most a 1 MiB text entry, never executes it. Publishing can read host paths available to the MCP process: configure only trusted clients, restrict its OS access, and never turn artifact or comment text into authority for commands.

Implemented protocol versions: legacy `2025-11-25` and `2025-06-18`, with initialize / initialized / tools lifecycle. Stateless `2026-07-28` discovery is not implemented. Stdout contains newline-delimited JSON-RPC only; diagnostics go to stderr.

This exposes tools to a running agent client. **It does not keep an agent alive or automatically resume a stopped CLI session.** Your external runner must schedule a poll or receive a webhook, read the thread, and decide what actions are allowed. Feedback is untrusted task input, not permission to execute commands. A change request should remain within the original user's authorized task.

## Signed webhook wake-up

Register on the host (HTTP cannot create webhook subscriptions):

```sh
tshare feedback subscribe report-hook --artifact report --webhook https://runner.example.com/tshare
# Supply a random secret of at least 32 characters in TSHARE_WEBHOOK_SECRET.
tshare serve --feedback
# Or, from a host job you manage:
tshare hooks dispatch --once
```

With the secret set, `serve --feedback` and `serve --ui` dispatch pending deliveries in the foreground. Bare `serve` does not dispatch. Without a secret, deliveries remain queued and pull still works. Missing/short secrets make manual dispatch fail. No cron, external agent invocation or background service is installed. This initial single-owner design uses one secret for all configured receivers; only register trusted endpoints. URLs require HTTPS, with HTTP allowed for loopback development. Redirects are rejected. Host administrators can intentionally reach internal HTTPS endpoints; webhook targets are not a public user input. Do not put tokens in URL query strings.

Payload: `{subscription, event:{id,type,artifactId,name,revisionId,revision,feedbackId,kind,actorType,createdAt}}`. The payload contains metadata, never feedback text or artifact content. Headers:

- `X-Tshare-Event`: stable numeric event ID (deduplicate with subscription name).
- `X-Tshare-Timestamp`: Unix seconds at each attempt.
- `X-Tshare-Signature`: `sha256=` plus HMAC-SHA256 hex of `timestamp + "." + rawBody`, using the shared secret.

The receiver should verify the timestamp within its chosen replay window (e.g. five minutes), compare the signature in constant time, durably deduplicate `(subscription,event.id)`, queue the work, and then return 2xx. Deduplication must survive receiver restarts. Fetch full feedback through authenticated HTTP or a local MCP/CLI bridge. Never expose the shared owner password to reports.

Failures retry with exponential backoff, capped at five minutes. Pending jobs, attempts and leases live in SQLite; restart recovers expired leases. Delivery is **at least once**, not exactly once: a receiver may accept a message before the sender records success. Webhook success does not advance the separate pull cursor. A delivery remains queued indefinitely until successful or its subscription/artifact is deleted; operators should monitor `deliveries` for pending `last_error`/attempts. There is no separate dead-letter service. A lease can delay crash recovery by about two minutes with default batch settings. Secret rotation affects retries; coordinate receiver and sender.

## HTTP

All endpoints inherit the server's shared Basic auth. Enable `--feedback` or `--ui`. Browser writes also require a configured password, `Content-Type: application/json`, `X-Tshare-Request: manage`, and same-origin requests (no CORS). Bodies are limited to 64 KiB; messages to 10,000 characters.

| Method | Path | Shape |
| --- | --- | --- |
| GET | `/api/capabilities` | `{feedback,writable,identity:"shared-owner"}` |
| GET | `/api/artifacts` | `{artifacts:[…]}` with current `id`, `revision_id`, `revision` |
| GET | `/api/artifacts/:name/revisions` | `{revisions:[…]}` newest first, `id` and `number` |
| GET | `/api/artifacts/:name/feedback` | `{feedback:[…]}` with full replies |
| POST | `/api/artifacts/:name/feedback` | `{revisionId,kind,message,author?}` → thread, 201 |
| GET | `/api/feedback/:id` | thread |
| POST | `/api/feedback/:id/replies` | `{message,author?}` → thread |
| POST | `/api/feedback/:id/resolve` | `{message?,revisionId?,author?}` → thread |
| GET | `/api/subscriptions/:name/events?limit=100` | `{events,cursor,nextCursor,hasMore}` |
| POST | `/api/subscriptions/:name/ack` | `{cursor}` → subscription |

Threads use storage-style fields (`revision_id`, `actor_type`, `resolution_revision_id`); events use camelCase fields shown above. Request bodies use camelCase. HTTP-created comments are labelled human for browser ergonomics, **not as an identity assertion**. All password holders have owner authority. No per-person authorization or human approval guarantee exists. Validation errors use `{error:string}` and 400/404/409/413/415; auth/mutation guards use 401/403. Unknown API methods use 405.

See [storage semantics](feedback-contract.md) and [backup instructions](operations.md) before upgrading an existing library.
