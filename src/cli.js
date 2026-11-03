#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';
import { parseArgs } from 'node:util';
import { Store } from './store.js';
import { createServer } from './server.js';

const help = `tshare — your artifacts, across your devices.

Usage:
  tshare <file|directory> [name] [--title TEXT] [--description TEXT]
  tshare share <file|directory> [name]
  tshare list [--json]
  tshare rm <name>
  tshare serve [--ui] [--host 127.0.0.1] [--port 8791]

Options:
  --data-dir PATH   Library location (or TSHARE_ROOT)
  --base-url URL    Public origin (or TSHARE_BASE_URL)
  --ui             Enable the optional library and read API
  --help           Show this help
  --version        Show version

Set TSHARE_PASSWORD for HTTP Basic authentication (username: tshare).
Required when binding beyond loopback, and for deletion in the web UI.
Use HTTPS through Tailscale Serve or a reverse proxy on remote devices.
No UI or API is served unless --ui is set.
`;
let store;
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { 'data-dir': { type: 'string' }, 'base-url': { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, host: { type: 'string', default: '127.0.0.1' }, port: { type: 'string', default: '8791' }, ui: { type: 'boolean' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' }, version: { type: 'boolean' } } });
  if (values.version) { console.log('0.1.0'); process.exit(0); }
  if (values.help || !positionals.length) { console.log(help); process.exit(0); }
  const [command, ...args] = positionals;
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be between 1 and 65535.');
  const base = (values['base-url'] || process.env.TSHARE_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, '');
  const baseURL = new URL(base);
  if (!['https:', 'http:'].includes(baseURL.protocol) || baseURL.username || baseURL.password || baseURL.search || baseURL.hash || baseURL.pathname !== '/') throw new Error('Base URL must be an HTTP(S) origin without a path or credentials.');
  store = new Store(values['data-dir'] || process.env.TSHARE_ROOT || path.join(os.homedir(), '.local/share/tshare-selfhost'));
  const url = item => `${base}/share/${encodeURIComponent(item.name)}/${item.entry === 'index.html' ? '' : item.entry.split('/').map(encodeURIComponent).join('/')}`;
  if (command === 'serve') {
    if (args.length) throw new Error('serve takes no positional arguments.');
    const password = process.env.TSHARE_PASSWORD || '';
    if (!['127.0.0.1', '::1', 'localhost'].includes(values.host) && !password) throw new Error('Set TSHARE_PASSWORD before binding beyond loopback.');
    const server = createServer(store, { ui: values.ui, password });
    server.on('error', error => { console.error(`tshare: ${error.message}`); store.close(); process.exitCode = 1; });
    server.listen(port, values.host, () => {
      console.log(`tshare listening on ${values.host}:${port}${values.ui ? ' (web library enabled)' : ' (CLI mode)'}`);
      console.log(`Public origin: ${base}`);
    });
    const shutdown = () => server.close(() => { store.close(); process.exit(0); });
    process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
  } else {
    if (command === 'list') {
      if (args.length) throw new Error('list takes no positional arguments.');
      const rows = store.list().map(item => ({ ...item, url: url(item) }));
      if (values.json) console.log(JSON.stringify(rows, null, 2));
      else for (const item of rows) console.log(`${item.name}\t${item.url}`);
    } else if (command === 'rm') {
      if (args.length !== 1) throw new Error('Usage: tshare rm <name>');
      store.remove(args[0]); console.log(`Removed: ${args[0]}`);
    } else {
      const shareArgs = command === 'share' ? args : [command, ...args];
      if (shareArgs.length < 1 || shareArgs.length > 2) throw new Error('Usage: tshare <file|directory> [name]');
      const item = store.share(shareArgs[0], { name: shareArgs[1], title: values.title, description: values.description });
      console.log(url(item));
    }
    store.close();
  }
} catch (error) { store?.close(); console.error(`tshare: ${error.message}`); process.exitCode = 1; }
