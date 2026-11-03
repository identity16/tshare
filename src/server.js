import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, timingSafeEqual } from 'node:crypto';
import { pipeline } from 'node:stream';
import { validName } from './store.js';
import { feedbackHTTP, management } from './feedback-http.js';

const webRoot = fileURLToPath(new URL('../web/', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const escape = value => value.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const digest = value => createHash('sha256').update(value).digest();
function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }
function serveFile(req, res, filename, { content = false, download = false } = {}) {
  const stat = fs.statSync(filename);
  if (!stat.isFile()) { json(res, 404, { error: 'File not found.' }); return; }
  const headers = { 'Content-Type': mime[path.extname(filename).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
  // Opaque origins prevent shared HTML/SVG from accessing the management origin.
  if (content) headers['Content-Security-Policy'] = "sandbox allow-scripts; default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; form-action 'none'; frame-src 'none'; frame-ancestors 'self'";
  if (download) headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(filename))}`;
  let start = 0, end = stat.size - 1, status = 200;
  if (req.headers.range && stat.size) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!match || (!match[1] && !match[2])) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); res.end(); return; }
    if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (start > end || start >= stat.size) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); res.end(); return; }
    status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
  }
  headers['Content-Length'] = stat.size ? end - start + 1 : 0;
  res.writeHead(status, headers);
  if (req.method === 'HEAD' || stat.size === 0) { res.end(); return; }
  pipeline(fs.createReadStream(filename, { start, end }), res, () => {});
}
export function createServer(store, { ui = false, feedback = false, password = '' } = {}) {
  return http.createServer({ maxHeaderSize: 16384, requestTimeout: 15000, headersTimeout: 10000 }, async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/healthz' && req.method === 'GET') { json(res, 200, { status: 'ok', ui }); return; }
      if (password && !timingSafeEqual(digest(req.headers.authorization || ''), digest(`Basic ${Buffer.from(`tshare:${password}`).toString('base64')}`))) {
        res.setHeader('WWW-Authenticate', 'Basic realm="tshare", charset="UTF-8"'); json(res, 401, { error: 'Authentication required.' }); return;
      }
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith('/api/')) {
        if (!ui && !feedback) { json(res, 404, { error: 'Web UI is disabled.' }); return; }
        if (await feedbackHTTP(req,res,url,store,{password,json})) return;
        if (pathname === '/api/artifacts' && req.method === 'GET') { json(res, 200, { artifacts: store.list() }); return; }
        if (pathname.startsWith('/api/artifacts/') && req.method === 'DELETE') {
          management(req,password);
          const name = validName(pathname.slice('/api/artifacts/'.length));
          if (!store.get(name)) { json(res, 404, { error: 'Artifact not found.' }); return; }
          store.remove(name); json(res, 200, { removed: name }); return;
        }
        json(res, 405, { error: 'Method not allowed.' }); return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) { json(res, 405, { error: 'Method not allowed.' }); return; }
      if (pathname.startsWith('/share/') || pathname.startsWith('/revision/')) {
        const historical = pathname.startsWith('/revision/');
        const parts = pathname.slice(historical ? 10 : 7).split('/'), name = validName(parts.shift());
        const revisionId = historical ? parts.shift() : url.searchParams.get('revision');
        if (!historical && revisionId) {
          const query=new URLSearchParams(url.searchParams); query.delete('revision');
          res.writeHead(308,{Location:`/revision/${encodeURIComponent(name)}/${encodeURIComponent(revisionId)}/${parts.map(encodeURIComponent).join('/')}${query.size?'?'+query:''}`});res.end();return;
        }
        let item = store.get(name);
        if (item && historical) { const revision=store.revision(name,revisionId); item=revision?{...revision,name,object:revision.id}:null; }
        if (!item) { json(res, 404, { error: 'Artifact not found.' }); return; }
        const root = path.join(store.root, 'objects', item.object);
        let relative = parts.join('/');
        if (!relative && !pathname.endsWith('/')) { res.writeHead(308, { Location: `${historical ? '/revision/'+encodeURIComponent(name)+'/'+encodeURIComponent(revisionId) : '/share/'+encodeURIComponent(name)}/${url.search}` }); res.end(); return; }
        if (!relative) relative = item.entry;
        let target = path.resolve(root, relative);
        if (target !== root && !target.startsWith(root + path.sep)) { json(res, 403, { error: 'Invalid path.' }); return; }
        const real = fs.realpathSync(target);
        if (real !== root && !real.startsWith(root + path.sep)) { json(res, 403, { error: 'Invalid path.' }); return; }
        if (fs.statSync(target).isDirectory()) {
          if (!pathname.endsWith('/')) {res.writeHead(308,{Location:url.pathname+'/'+url.search});res.end();return;}
          if (fs.existsSync(path.join(target, 'index.html'))) target = path.join(target, 'index.html');
          else {
            const revisionQuery=url.searchParams.has('revision') ? '?revision='+encodeURIComponent(url.searchParams.get('revision')) : '';
            const entries = fs.readdirSync(target, { withFileTypes: true }).map(entry => `<li><a href="${encodeURIComponent(entry.name)}${entry.isDirectory() ? '/' : ''}${revisionQuery}">${escape(entry.name)}${entry.isDirectory() ? '/' : ''}</a></li>`).join('');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>${escape(name)}</title><h1>${escape(name)}</h1><ul>${entries}</ul></html>`); return;
          }
        }
        serveFile(req, res, target, { content: true, download: url.searchParams.has('download') }); return;
      }
      if (ui && ['/', '/app.js', '/review.js', '/style.css'].includes(pathname)) { serveFile(req, res, path.join(webRoot, pathname === '/' ? 'index.html' : pathname.slice(1))); return; }
      json(res, 404, { error: ui ? 'Not found.' : 'CLI mode. Shared artifacts are at /share/<name>/. Enable the library with serve --ui.' });
    } catch (error) {
      if (res.headersSent) { res.destroy(); return; }
      json(res, error.status || (['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 400), { error: error.status ? error.message : ['ENOENT', 'ENOTDIR'].includes(error.code) ? 'Not found.' : 'Invalid request.' });
    }
  });
}
