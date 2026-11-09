import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { initializeSchema } from './schema.js';
import { Feedback } from './feedback.js';

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
// Shared HTML is served under a CSP that only allows same-origin and inline resources, so anything loaded from
// another origin is silently blocked in the viewer. Report those references at publish time instead.
const TAG = /<(script|img|iframe|source|video|audio|embed|object|link)\b[^>]*>/gi, CSS = /(?:@import\s+(?:url\(\s*)?|url\(\s*)["']?((?:https?:)?\/\/[^"')\s;]+)/gi;
const attribute = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find(value => value !== undefined);
const external = value => /^(?:https?:)?\/\//i.test(value ?? '');
// Links that only point elsewhere (canonical, alternate, preconnect…) load nothing, so only loading relations count.
function loads(tag, name) {
  if (name === 'link') return /\b(?:stylesheet|icon|preload|modulepreload|manifest)\b/i.test(attribute(tag, 'rel') ?? '') ? attribute(tag, 'href') : undefined;
  return attribute(tag, name === 'object' ? 'data' : 'src');
}
function htmlFiles(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(file, found);
    else if (/\.html?$/i.test(entry.name) && found.length < 200) found.push(file);
  }
  return found;
}
export function externalResources(destination) {
  const warnings = [];
  for (const file of htmlFiles(destination)) {
    if (fs.statSync(file).size > 4194304) continue;
    const html = fs.readFileSync(file, 'utf8');
    const urls = new Set([...[...html.matchAll(TAG)].map(([tag, name]) => loads(tag, name.toLowerCase())), ...[...html.matchAll(CSS)].map(match => match[1])].filter(external));
    if (urls.size) warnings.push({ file: path.relative(destination, file).split(path.sep).join('/'), urls: [...urls].slice(0, 5), count: urls.size });
  }
  return warnings;
}
export class Store {
  constructor(root) {
    this.root = path.resolve(root);
    fs.mkdirSync(path.join(this.root, 'objects'), { recursive: true, mode: 0o700 });
    this.root = fs.realpathSync(this.root);
    this.db = new DatabaseSync(path.join(this.root, 'library.sqlite'));
    try { initializeSchema(this.db); }
    catch (error) { this.db.close(); throw error; }
    this.feedback = new Feedback(this);
  }
  list() { return this.db.prepare('SELECT a.name,a.id,a.title,a.description,a.kind,a.entry,a.bytes,a.created_at,a.object AS revision_id,r.number AS revision FROM artifacts a JOIN revisions r ON r.id=a.object ORDER BY a.created_at DESC,a.name').all(); }
  get(name) { return this.db.prepare('SELECT a.*,r.number AS revision FROM artifacts a JOIN revisions r ON r.id=a.object WHERE a.name=?').get(name); }
  revisions(name) { const item = this.get(name); if (!item) return []; return this.db.prepare('SELECT * FROM revisions WHERE artifact_id=? ORDER BY number DESC').all(item.id); }
  revision(name, id) { const item = this.get(name); if (!item) return undefined; return this.db.prepare('SELECT * FROM revisions WHERE artifact_id=? AND id=?').get(item.id, id); }

  share(source, { name, title, description = '', actorType = 'human' } = {}) {
    if (!['human', 'agent'].includes(actorType)) throw new Error('Invalid actor type.');
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
      const artifactId = old?.id || randomUUID(), createdAt = new Date().toISOString();
      this.db.prepare(`INSERT INTO artifacts(name,object,title,description,kind,entry,bytes,created_at,id) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET object=excluded.object,title=excluded.title,description=excluded.description,kind=excluded.kind,entry=excluded.entry,bytes=excluded.bytes,created_at=excluded.created_at`).run(name, object, title, description, kind, entry, bytes, createdAt, artifactId);
      this.db.prepare('INSERT INTO revisions VALUES (?,?,?,?,?,?,?,?,?)').run(object, artifactId, (old?.revision || 0) + 1, title, description, kind, entry, bytes, createdAt);
      this.feedback.record('artifact.revised', {id:artifactId}, object, null, null, actorType);
      this.db.exec('COMMIT');
      return { ...this.get(name), warnings: kind === 'html' || isDirectory ? externalResources(destination) : [] };
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
      const objects = this.revisions(name).map(revision => revision.id);
      this.db.prepare('DELETE FROM artifacts WHERE name=?').run(name);
      this.db.exec('COMMIT');
      for (const object of objects) this.discard(object);
    } catch (error) { if (this.db.isTransaction) this.db.exec('ROLLBACK'); throw error; }
  }
  close() { this.db.close(); }
}
