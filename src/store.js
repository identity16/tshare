import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function validName(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(name)) throw new Error('Use 1–96 letters, numbers, dots, underscores or hyphens; start with a letter or number.');
  return name;
}
function inspect(source) {
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error('Symbolic links are not imported. Copy their contents explicitly.');
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory()) throw new Error('Only regular files and directories can be shared.');
  return fs.readdirSync(source).reduce((size, name) => size + inspect(path.join(source, name)), 0);
}
export class Store {
  constructor(root) {
    this.root = path.resolve(root);
    fs.mkdirSync(path.join(this.root, 'objects'), { recursive: true, mode: 0o700 });
    this.root = fs.realpathSync(this.root);
    this.db = new DatabaseSync(path.join(this.root, 'library.sqlite'));
    this.db.exec('PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL;');
    const { user_version: version } = this.db.prepare('PRAGMA user_version').get();
    if (version > 1) { this.db.close(); throw new Error('This library was created by a newer tshare version.'); }
    this.db.exec(`CREATE TABLE IF NOT EXISTS artifacts (
      name TEXT PRIMARY KEY, object TEXT NOT NULL, title TEXT NOT NULL,
      description TEXT NOT NULL, kind TEXT NOT NULL, entry TEXT NOT NULL,
      bytes INTEGER NOT NULL, created_at TEXT NOT NULL
    ); PRAGMA user_version=1;`);
  }
  list() { return this.db.prepare('SELECT name,title,description,kind,entry,bytes,created_at FROM artifacts ORDER BY created_at DESC, name').all(); }
  get(name) { return this.db.prepare('SELECT * FROM artifacts WHERE name=?').get(name); }
  share(source, { name, title, description = '' } = {}) {
    source = path.resolve(source);
    // Avoid importing the library into itself, including through a symlinked parent.
    const realSource = fs.realpathSync(source), realRoot = fs.realpathSync(this.root);
    if (realSource === realRoot || realSource.startsWith(realRoot + path.sep) || realRoot.startsWith(realSource + path.sep)) throw new Error('Source and library must be separate directories.');
    const basename = path.basename(source);
    name = validName(name || path.parse(basename).name);
    title ||= basename;
    if (title.length > 200 || description.length > 2000) throw new Error('Title must be at most 200 characters; description at most 2000.');
    const bytes = inspect(source), isDirectory = fs.statSync(source).isDirectory();
    const object = randomUUID(), destination = path.join(this.root, 'objects', object);
    fs.mkdirSync(destination, { mode: 0o700 });
    const extension = path.extname(source).toLowerCase();
    let entry = isDirectory ? '' : (['.html', '.htm'].includes(extension) ? 'index.html' : basename);
    let kind = isDirectory ? 'folder' : ['.html', '.htm'].includes(extension) ? 'html' : extension === '.md' ? 'markdown' : extension === '.pdf' ? 'pdf' : ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension) ? 'image' : 'file';
    try {
      if (isDirectory) {
        fs.cpSync(source, destination, { recursive: true, dereference: false, filter: src => { if (fs.lstatSync(src).isSymbolicLink()) throw new Error('Symbolic links are not imported.'); return true; } });
        if (fs.existsSync(path.join(destination, 'index.html'))) { entry = 'index.html'; kind = 'html'; }
      } else fs.copyFileSync(source, path.join(destination, entry));
      this.db.exec('BEGIN IMMEDIATE');
      const old = this.get(name);
      this.db.prepare(`INSERT INTO artifacts VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET object=excluded.object,title=excluded.title,description=excluded.description,kind=excluded.kind,entry=excluded.entry,bytes=excluded.bytes,created_at=excluded.created_at`).run(name, object, title, description, kind, entry, bytes, new Date().toISOString());
      this.db.exec('COMMIT');
      if (old) this.discard(old.object);
      return this.get(name);
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      this.discard(object);
      throw error;
    }
  }
  discard(object) {
    // A failed cleanup leaves an orphan, never invalidates a committed artifact.
    try { fs.rmSync(path.join(this.root, 'objects', object), { recursive: true, force: true }); } catch { /* See docs/operations.md. */ }
  }
  remove(name) {
    validName(name);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const item = this.get(name);
      if (!item) throw new Error('Artifact not found.');
      this.db.prepare('DELETE FROM artifacts WHERE name=?').run(name);
      this.db.exec('COMMIT');
      this.discard(item.object);
    } catch (error) { if (this.db.isTransaction) this.db.exec('ROLLBACK'); throw error; }
  }
  close() { this.db.close(); }
}
