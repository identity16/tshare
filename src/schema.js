import { randomUUID } from 'node:crypto';

export function atomic(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const value = fn(); db.exec('COMMIT'); return value; }
  catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
}

export function initializeSchema(db) {
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL;');
  atomic(db, () => {
    const { user_version: version } = db.prepare('PRAGMA user_version').get();
    if (version > 2) throw new Error('This library was created by a newer tshare version.');
    if (version === 2) return;
    if (version === 0) db.exec(`CREATE TABLE artifacts (
      name TEXT PRIMARY KEY, object TEXT NOT NULL, title TEXT NOT NULL,
      description TEXT NOT NULL, kind TEXT NOT NULL, entry TEXT NOT NULL,
      bytes INTEGER NOT NULL, created_at TEXT NOT NULL, id TEXT NOT NULL UNIQUE
    )`);
    else {
      db.exec('ALTER TABLE artifacts ADD COLUMN id TEXT');
      const update = db.prepare('UPDATE artifacts SET id=? WHERE name=?');
      for (const row of db.prepare('SELECT name FROM artifacts').all()) update.run(randomUUID(), row.name);
      db.exec('CREATE UNIQUE INDEX artifacts_id ON artifacts(id)');
    }
    db.exec(`
      CREATE TABLE revisions (
        id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
        number INTEGER NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
        kind TEXT NOT NULL, entry TEXT NOT NULL, bytes INTEGER NOT NULL, created_at TEXT NOT NULL,
        UNIQUE(artifact_id,number)
      );
      INSERT INTO revisions SELECT object,id,1,title,description,kind,entry,bytes,created_at FROM artifacts;
      CREATE TABLE feedback (
        id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
        revision_id TEXT NOT NULL REFERENCES revisions(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK(kind IN ('question','suggestion','change_request','decision')),
        author TEXT NOT NULL, actor_type TEXT NOT NULL CHECK(actor_type IN ('human','agent')),
        message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
        created_at TEXT NOT NULL, resolution TEXT, resolution_revision_id TEXT REFERENCES revisions(id), resolved_at TEXT
      );
      CREATE INDEX feedback_artifact ON feedback(artifact_id,created_at,id);
      CREATE TABLE replies (
        id TEXT PRIMARY KEY, feedback_id TEXT NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
        author TEXT NOT NULL, actor_type TEXT NOT NULL CHECK(actor_type IN ('human','agent')),
        message TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL, artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
        revision_id TEXT NOT NULL REFERENCES revisions(id) ON DELETE CASCADE,
        feedback_id TEXT REFERENCES feedback(id) ON DELETE CASCADE,
        kind TEXT, actor_type TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE subscriptions (
        name TEXT PRIMARY KEY, artifact_id TEXT REFERENCES artifacts(id) ON DELETE CASCADE,
        kinds TEXT NOT NULL, types TEXT NOT NULL, actors TEXT NOT NULL,
        cursor INTEGER NOT NULL, webhook_url TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE deliveries (
        subscription TEXT NOT NULL REFERENCES subscriptions(name) ON DELETE CASCADE,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
        lease_until INTEGER NOT NULL DEFAULT 0, lease_token TEXT,
        delivered_at TEXT, last_error TEXT,
        PRIMARY KEY(subscription,event_id)
      );
      PRAGMA user_version=2;
    `);
  });
}
