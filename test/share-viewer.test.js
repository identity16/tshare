import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {Store} from '../src/store.js';
import {createServer} from '../src/server.js';
async function fixture(t,options={ui:true}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tshare-shared-')),store=new Store(path.join(root,'data')),source=path.join(root,'site');fs.mkdirSync(source);fs.writeFileSync(path.join(source,'index.html'),'<h1>First</h1><link rel="stylesheet" href="style.css">');fs.writeFileSync(path.join(source,'style.css'),'/* first */');
 const first=store.share(source,{name:'report',title:'</script><script>window.injected=true</script>',description:'<img src=x onerror=alert(1)>'});fs.writeFileSync(path.join(source,'index.html'),'<h1>Second</h1>');fs.writeFileSync(path.join(source,'style.css'),'/* second */');store.share(source,{name:'report'});
 const server=createServer(store,options);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));store.close();fs.rmSync(root,{recursive:true,force:true});});return {store,root,first,origin:'http://127.0.0.1:'+server.address().port};
}
test('shared viewer is explicit, escapes metadata, pins files and keeps all resources under /share',async t=>{
 const {origin,first}=await fixture(t);assert.equal(await(await fetch(origin+'/share/report/')).text(),'<h1>Second</h1>');
 const url=origin+`/share/report/?view=1&revision=${first.object}`;const response=await fetch(url),html=await response.text();assert.equal(response.url,url);assert.match(html,/id="viewer-tools"/);assert.ok(!html.includes('window.injected=true</script>'));assert.match(html,/\\u003c\/script\\u003e/);assert.ok(!response.headers.get('content-security-policy').includes('sandbox'));
 assert.equal((await fetch(url,{method:'HEAD'})).headers.get('content-length'),String(Buffer.byteLength(html)));
 for(const asset of ['share.js','share.css','viewer.js','markdown.js','style.css','reader.css'])assert.equal((await fetch(origin+'/share/.tshare/assets/'+asset)).status,200);
 assert.equal((await fetch(origin+'/share/.tshare/assets/app.js')).status,404);assert.equal((await fetch(origin+'/share/.tshare/assets/src/store.js')).status,404);
 const pinned=origin+`/share/.tshare/revision/report/${first.object}/`;const old=await fetch(pinned);assert.match(await old.text(),/First/);assert.match(old.headers.get('content-security-policy'),/sandbox allow-scripts/);assert.ok(!old.headers.get('content-security-policy').includes('allow-same-origin'));assert.equal(await(await fetch(new URL('style.css',pinned))).text(),'/* first */');
 const raw=await fetch(origin+'/share/report/?view=1&download');assert.equal(await raw.text(),'<h1>Second</h1>');assert.match(raw.headers.get('content-disposition'),/attachment/);
 assert.equal((await fetch(origin+'/share/report/?view=1&revision=missing')).status,404);assert.equal((await fetch(origin+`/share/.tshare/revision/report/${first.object}/..%2f..%2flibrary.sqlite`)).status,403);
});
test('UI off keeps original bytes for new CLI links and does not expose viewer resources',async t=>{
 const {origin}=await fixture(t,{ui:false});assert.equal(await(await fetch(origin+'/share/report/?view=1')).text(),'<h1>Second</h1>');assert.equal((await fetch(origin+'/share/.tshare/assets/share.js')).status,404);assert.equal((await fetch(origin+'/api/artifacts')).status,404);
});
test('shared viewer, assets and immutable gateway inherit the configured authentication',async t=>{
 const {origin,first}=await fixture(t,{ui:true,password:'test-only'});for(const route of ['/share/report/?view=1','/share/.tshare/assets/share.js',`/share/.tshare/revision/report/${first.object}/`]){assert.equal((await fetch(origin+route)).status,401);assert.equal((await fetch(origin+route,{headers:{Authorization:'Basic '+Buffer.from('tshare:test-only').toString('base64')}})).status,200);}
});
test('CLI publishes and lists the same viewer URL without modifying the original resource route',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tshare-share-cli-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const file=path.join(root,'note.md');fs.writeFileSync(file,'# Sample');const run=args=>spawnSync(process.execPath,['src/cli.js','--data-dir',path.join(root,'data'),'--base-url','https://example.com',...args],{encoding:'utf8'});const output=run([file,'note']);assert.equal(output.status,0);assert.equal(output.stdout.trim(),'https://example.com/share/note/note.md?view=1');assert.equal(JSON.parse(run(['list','--json']).stdout)[0].url,output.stdout.trim());
});
