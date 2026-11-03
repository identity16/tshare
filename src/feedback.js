import { randomUUID } from 'node:crypto';
import { atomic } from './schema.js';

export const KINDS = ['question', 'suggestion', 'change_request', 'decision'];
export const EVENT_TYPES = ['feedback.created', 'feedback.replied', 'feedback.resolved', 'artifact.revised'];
export function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
export function text(value, label, max = 10000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) fail(`${label} must contain 1–${max} characters.`);
  return value.trim();
}
export function integer(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(`Invalid ${label}.`);
  return value;
}
function choices(value, allowed, label) {
  if (!Array.isArray(value) || value.some(v => !allowed.includes(v))) fail(`Invalid ${label}.`);
  return [...new Set(value)];
}
function actor(input) {
  const actorType = input.actorType || 'human';
  if (!['human', 'agent'].includes(actorType)) fail('Invalid actor type.');
  return { actorType, author: text(input.author || (actorType === 'agent' ? 'Agent' : 'Owner'), 'Display name', 100) };
}
export function webhookURL(value) {
  if (value == null || value === '') return null;
  let url;
  try { url = new URL(value); } catch { fail('Invalid webhook URL.'); }
  const local = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
  if (!['https:', 'http:'].includes(url.protocol) || (url.protocol === 'http:' && !local) || url.username || url.password || url.hash) fail('Webhooks require HTTPS (HTTP is allowed for loopback only), without credentials or a fragment.');
  return url.href;
}
const matches = (sub, event) => (!sub.artifact_id || sub.artifact_id === event.artifact_id)
  && (!JSON.parse(sub.kinds).length || JSON.parse(sub.kinds).includes(event.kind))
  && JSON.parse(sub.types).includes(event.type) && JSON.parse(sub.actors).includes(event.actor_type);

export class Feedback {
  constructor(store) { this.store = store; this.db = store.db; }
  artifact(name) { const item = this.store.get(name); if (!item) fail('Artifact not found.', 404); return item; }
  thread(id) {
    const row = this.db.prepare(`SELECT f.*,a.name,r.number AS revision FROM feedback f JOIN artifacts a ON a.id=f.artifact_id JOIN revisions r ON r.id=f.revision_id WHERE f.id=?`).get(text(id, 'Feedback ID', 100));
    if (!row) fail('Feedback not found.', 404);
    return { ...row, replies: this.db.prepare('SELECT * FROM replies WHERE feedback_id=? ORDER BY created_at,rowid').all(id) };
  }
  list(name) { const item = this.artifact(name); return this.db.prepare('SELECT id FROM feedback WHERE artifact_id=? ORDER BY created_at,rowid').all(item.id).map(row => this.thread(row.id)); }
  record(type, artifact, revisionId, feedbackId = null, kind = null, actorType = 'human') {
    if (!this.db.isTransaction) throw new Error('Events must be committed with their mutation.');
    const createdAt = new Date().toISOString();
    const result = this.db.prepare('INSERT INTO events(type,artifact_id,revision_id,feedback_id,kind,actor_type,created_at) VALUES (?,?,?,?,?,?,?)').run(type, artifact.id, revisionId, feedbackId, kind, actorType, createdAt);
    const event = { id: Number(result.lastInsertRowid), type, artifact_id: artifact.id, revision_id: revisionId, feedback_id: feedbackId, kind, actor_type: actorType };
    for (const sub of this.db.prepare('SELECT * FROM subscriptions WHERE webhook_url IS NOT NULL').all()) {
      if (matches(sub, event)) this.db.prepare('INSERT INTO deliveries(subscription,event_id) VALUES (?,?)').run(sub.name, event.id);
    }
    return event.id;
  }
  create(name, input) {
    const message = text(input.message, 'Feedback'), who = actor(input);
    if (!KINDS.includes(input.kind)) fail('Choose question, suggestion, change_request, or decision.');
    return atomic(this.db, () => {
      const item = this.artifact(name), revision = this.store.revision(name, text(input.revisionId, 'Revision ID', 100));
      if (!revision) fail('Revision not found for this artifact.', 404);
      const id = randomUUID();
      this.db.prepare('INSERT INTO feedback(id,artifact_id,revision_id,kind,author,actor_type,message,created_at) VALUES (?,?,?,?,?,?,?,?)').run(id, item.id, revision.id, input.kind, who.author, who.actorType, message, new Date().toISOString());
      this.record('feedback.created', item, revision.id, id, input.kind, who.actorType);
      return this.thread(id);
    });
  }
  reply(id, input) {
    const message = text(input.message, 'Reply'), who = actor(input);
    return atomic(this.db, () => {
      const thread = this.thread(id);
      this.db.prepare('INSERT INTO replies VALUES (?,?,?,?,?,?)').run(randomUUID(), id, who.author, who.actorType, message, new Date().toISOString());
      this.record('feedback.replied', { id: thread.artifact_id }, thread.revision_id, id, thread.kind, who.actorType);
      return this.thread(id);
    });
  }
  resolve(id, input = {}) {
    const who = actor(input);
    const resolution = input.message ? text(input.message, 'Resolution') : '';
    if (!input.revisionId && !resolution) fail('Give a resolution message or explicitly link a revision.');
    return atomic(this.db, () => {
      const thread = this.thread(id);
      const revision = input.revisionId ? this.store.revision(thread.name, text(input.revisionId, 'Revision ID', 100)) : null;
      if (input.revisionId && (!revision || revision.number < thread.revision)) fail('Resolution revision must belong to this artifact and must not predate the feedback.');
      if (thread.status === 'resolved') {
        if ((thread.resolution_revision_id || null) !== (revision?.id || null) || thread.resolution !== resolution) fail('Feedback is already resolved differently.', 409);
        return thread;
      }
      this.db.prepare("UPDATE feedback SET status='resolved',resolution=?,resolution_revision_id=?,resolved_at=? WHERE id=?").run(resolution, revision?.id || null, new Date().toISOString(), id);
      if (resolution) this.db.prepare('INSERT INTO replies VALUES (?,?,?,?,?,?)').run(randomUUID(), id, who.author, who.actorType, resolution, new Date().toISOString());
      this.record('feedback.resolved', { id: thread.artifact_id }, revision?.id || thread.revision_id, id, thread.kind, who.actorType);
      return this.thread(id);
    });
  }
  latestCursor() { return Number(this.db.prepare("SELECT seq FROM sqlite_sequence WHERE name='events'").get()?.seq || 0); }
  subscribe(name, input = {}) {
    if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(name)) fail('Invalid subscription name.');
    const kinds = choices(input.kinds || [], KINDS, 'feedback kinds');
    const types = choices(input.types || ['feedback.created', 'feedback.replied', 'feedback.resolved'], EVENT_TYPES, 'event types');
    const actors = choices(input.actors || ['human'], ['human', 'agent'], 'actors');
    if (!types.length || !actors.length) fail('Subscription event types and actors cannot be empty.');
    const url = webhookURL(input.webhookURL);
    return atomic(this.db, () => {
      const artifactId = input.artifact ? this.artifact(input.artifact).id : null;
      const old = this.db.prepare('SELECT * FROM subscriptions WHERE name=?').get(name);
      const cursor = input.after == null ? this.latestCursor() : integer(input.after, 'cursor', 0, this.latestCursor());
      if (old) {
        if (old.artifact_id !== artifactId || old.kinds !== JSON.stringify(kinds) || old.types !== JSON.stringify(types) || old.actors !== JSON.stringify(actors) || old.webhook_url !== url) fail('Subscription already exists with different settings. Use another name or unsubscribe first.', 409);
        return this.subscription(name);
      }
      this.db.prepare('INSERT INTO subscriptions VALUES (?,?,?,?,?,?,?,?)').run(name, artifactId, JSON.stringify(kinds), JSON.stringify(types), JSON.stringify(actors), cursor, url, new Date().toISOString());
      if (url) for (const event of this.db.prepare('SELECT * FROM events WHERE id>? ORDER BY id').all(cursor)) if (matches(this.db.prepare('SELECT * FROM subscriptions WHERE name=?').get(name), event)) this.db.prepare('INSERT INTO deliveries(subscription,event_id) VALUES (?,?)').run(name, event.id);
      return this.subscription(name);
    });
  }
  subscription(name) {
    const row = this.db.prepare('SELECT * FROM subscriptions WHERE name=?').get(text(name, 'Subscription', 96));
    if (!row) fail('Subscription not found.', 404);
    return { ...row, kinds: JSON.parse(row.kinds), types: JSON.parse(row.types), actors: JSON.parse(row.actors) };
  }
  unsubscribe(name) { this.subscription(name); this.db.prepare('DELETE FROM subscriptions WHERE name=?').run(name); return { removed: name }; }
  event(id) {
    const row = this.db.prepare('SELECT e.*,a.name,r.number AS revision FROM events e JOIN artifacts a ON a.id=e.artifact_id JOIN revisions r ON r.id=e.revision_id WHERE e.id=?').get(id);
    if (!row) return null;
    return { id: row.id, type: row.type, artifactId: row.artifact_id, name: row.name, revisionId: row.revision_id, revision: row.revision, feedbackId: row.feedback_id, kind: row.kind, actorType: row.actor_type, createdAt: row.created_at };
  }
  poll(name, limit = 100) {
    integer(limit, 'limit', 1, 200);
    const sub = this.subscription(name), result = [];
    const filter = { ...sub, kinds: JSON.stringify(sub.kinds), types: JSON.stringify(sub.types), actors: JSON.stringify(sub.actors) };
    for (const row of this.db.prepare('SELECT * FROM events WHERE id>? ORDER BY id').iterate(sub.cursor)) {
      if (matches(filter, row)) result.push(this.event(row.id));
      if (result.length > limit) break;
    }
    const hasMore = result.length > limit; if (hasMore) result.pop();
    return { events: result, cursor: sub.cursor, nextCursor: result.at(-1)?.id || sub.cursor, hasMore };
  }
  ack(name, cursor) {
    return atomic(this.db, () => {
      const sub = this.subscription(name); integer(cursor, 'cursor', 0, this.latestCursor());
      this.db.prepare('UPDATE subscriptions SET cursor=? WHERE name=?').run(Math.max(sub.cursor, cursor), name);
      return this.subscription(name);
    });
  }
}
