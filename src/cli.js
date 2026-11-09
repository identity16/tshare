#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';
import { parseArgs } from 'node:util';
import { Store } from './store.js';
import { createServer } from './server.js';
import { runMCP } from './mcp.js';
import { dispatchHooks, startHooks } from './hooks.js';

const help = `tshare — your artifacts, across your devices.

Usage:
  tshare <file|directory> [name] [--title TEXT] [--description TEXT]
  tshare share <file|directory> [name]
  tshare list [--json]
  tshare rm <name>
  tshare revisions <name>
  tshare feedback <add|list|get|reply|resolve|subscribe|poll|ack|unsubscribe> <name|id>
  tshare mcp
  tshare serve [--feedback] [--ui] [--host 127.0.0.1] [--port 8791]

Options:
  --data-dir PATH   Library location (or TSHARE_ROOT)
  --base-url URL    Public origin (or TSHARE_BASE_URL)
  --ui             Enable the optional library and read API
  --help           Show this help
  --version        Show version

Set TSHARE_PASSWORD for HTTP Basic authentication (username: tshare).
Required when binding beyond loopback, and for deletion in the web UI.
Use HTTPS through Tailscale Serve or a reverse proxy on remote devices.
Published links use ?view=1 for file tools when --ui is enabled; otherwise they open the original.
No UI is served unless --ui is set. --feedback enables the feedback API without UI.
Webhook dispatch: tshare hooks dispatch --once (TSHARE_WEBHOOK_SECRET required).
Feedback flags: --kind --message --author --actor --revision --artifact --kinds
--types --actors --webhook --after --limit. See docs/feedback.md for examples.
`;
let store;
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { 'data-dir': { type: 'string' }, 'base-url': { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, host: { type: 'string', default: '127.0.0.1' }, port: { type: 'string', default: '8791' }, ui: { type: 'boolean' }, feedback: { type:'boolean' }, kind:{type:'string'}, message:{type:'string'}, author:{type:'string'}, actor:{type:'string'}, revision:{type:'string'}, artifact:{type:'string'}, kinds:{type:'string'}, types:{type:'string'}, actors:{type:'string'}, webhook:{type:'string'}, after:{type:'string'}, limit:{type:'string'}, once:{type:'boolean'}, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' }, version: { type: 'boolean' } } });
  if (values.version) { console.log('0.1.0'); process.exit(0); }
  if (values.help || !positionals.length) { console.log(help); process.exit(0); }
  const [command, ...args] = positionals;
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be between 1 and 65535.');
  const base = (values['base-url'] || process.env.TSHARE_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, '');
  const baseURL = new URL(base);
  if (!['https:', 'http:'].includes(baseURL.protocol) || baseURL.username || baseURL.password || baseURL.search || baseURL.hash || baseURL.pathname !== '/') throw new Error('Base URL must be an HTTP(S) origin without a path or credentials.');
  store = new Store(values['data-dir'] || process.env.TSHARE_ROOT || path.join(os.homedir(), '.local/share/tshare-selfhost'));
  const url = item => `${base}/share/${encodeURIComponent(item.name)}/${item.entry === 'index.html' ? '' : item.entry.split('/').map(encodeURIComponent).join('/')}?view=1`;
  if (command === 'mcp') {
    if (args.length) throw Error('mcp takes no positional arguments.');
    await runMCP(store); store.close();
  } else if (command === 'serve') {
    if (args.length) throw new Error('serve takes no positional arguments.');
    const password = process.env.TSHARE_PASSWORD || '';
    if (!['127.0.0.1', '::1', 'localhost'].includes(values.host) && !password) throw new Error('Set TSHARE_PASSWORD before binding beyond loopback.');
    const server = createServer(store, { ui: values.ui, feedback: values.feedback, password });
    const secret=process.env.TSHARE_WEBHOOK_SECRET;
    if (secret && secret.length<32) throw Error('TSHARE_WEBHOOK_SECRET must contain at least 32 characters.');
    const stopHooks=secret && (values.feedback || values.ui) ? startHooks(store,{secret}) : async()=>{};
    server.on('error', async error => { console.error(`tshare: ${error.message}`); await stopHooks(); store.close(); process.exitCode = 1; });
    server.listen(port, values.host, () => {
      console.log(`tshare listening on ${values.host}:${port}${values.ui ? ' (web library enabled)' : values.feedback ? ' (feedback API enabled)' : ' (CLI mode)'}`);
      console.log(`Public origin: ${base}`);
    });
    const shutdown = () => server.close(async () => { await stopHooks(); store.close(); process.exit(0); });
    process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
  } else {
    if (command === 'hooks') {
      if (args.length!==1 || args[0]!=='dispatch' || !values.once) throw Error('Usage: tshare hooks dispatch --once');
      console.log(JSON.stringify(await dispatchHooks(store,{secret:process.env.TSHARE_WEBHOOK_SECRET})));
    } else if (command === 'revisions') {
      if (args.length !== 1) throw Error('Usage: tshare revisions <name>');
      store.feedback.artifact(args[0]); console.log(JSON.stringify(store.revisions(args[0]),null,2));
    } else if (command === 'feedback') {
      const [action, name, cursor] = args, f = store.feedback;
      if (!name || args.length > (action === 'ack' ? 3 : 2)) throw Error('Usage: tshare feedback <add|list|get|reply|resolve|subscribe|poll|ack|unsubscribe> <name|id>');
      const input = {message:values.message, author:values.author, actorType:values.actor || 'human', revisionId:values.revision};
      let result;
      if (action === 'add') result = f.create(name,{...input,kind:values.kind,revisionId:values.revision || f.artifact(name).object});
      else if (action === 'list') result = f.list(name);
      else if (action === 'get') result = f.thread(name);
      else if (action === 'reply') result = f.reply(name,input);
      else if (action === 'resolve') result = f.resolve(name,input);
      else if (action === 'subscribe') result = f.subscribe(name,{artifact:values.artifact,kinds:values.kinds?.split(','),types:values.types?.split(','),actors:values.actors?.split(','),webhookURL:values.webhook,after:values.after === undefined ? undefined : Number(values.after)});
      else if (action === 'poll') result = f.poll(name,values.limit === undefined ? undefined : Number(values.limit));
      else if (action === 'ack') result = f.ack(name,Number(cursor));
      else if (action === 'unsubscribe') result = f.unsubscribe(name);
      else throw Error('Unknown feedback action.');
      console.log(JSON.stringify(result,null,2));
    } else if (command === 'list') {
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
      const item = store.share(shareArgs[0], { name: shareArgs[1], title: values.title, description: values.description, actorType: values.actor || 'human' });
      console.log(url(item));
      for (const { file, urls, count } of item.warnings) console.error(`tshare: warning: ${file} loads ${urls.join(', ')}${count > urls.length ? ` and ${count - urls.length} more` : ''} from another origin; the viewer blocks it. Inline it or publish a rendered copy.`);
    }
    store.close();
  }
} catch (error) { store?.close(); console.error(`tshare: ${error.message}`); process.exitCode = 1; }
