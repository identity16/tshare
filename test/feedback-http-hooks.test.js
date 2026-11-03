import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createHmac } from 'node:crypto';
import { Store } from '../src/store.js';
import { createServer } from '../src/server.js';
import { dispatchHooks } from '../src/hooks.js';
async function fixture(t,options={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tshare-http-')), file=path.join(root,'report.html'), db=path.join(root,'library');fs.writeFileSync(file,'<h1>First</h1>');
  const store=new Store(db), item=store.share(file,{name:'report'}), server=createServer(store,options);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>server.close(r));store.close();fs.rmSync(root,{recursive:true,force:true});});
  const origin=`http://127.0.0.1:${server.address().port}`;
  const headers={Authorization:`Basic ${Buffer.from('tshare:password').toString('base64')}`,'X-Tshare-Request':'manage','Content-Type':'application/json',Origin:origin};
  return {store,db,file,item,origin,headers};
}
test('feedback-only HTTP authenticates, pins reviewed revision, rejects CSRF and malformed input, preserves historical content',async t=>{
  const {store,file,item,origin,headers}=await fixture(t,{feedback:true,password:'password'});
  assert.equal((await fetch(origin+'/',{headers})).status,404);
  assert.equal((await fetch(origin+'/api/artifacts/report/feedback')).status,401);
  const post=(suffix,input,extra={})=>fetch(origin+suffix,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(input)});
  const input={revisionId:item.object,kind:'change_request',message:'Include assumptions.',author:'Reviewer',actorType:'agent'};
  assert.equal((await post('/api/artifacts/report/feedback',input,{Origin:'https://evil.example'})).status,403);
  assert.equal((await post('/api/artifacts/report/feedback',input,{'X-Tshare-Request':''})).status,403);
  assert.equal((await post('/api/artifacts/report/feedback',{...input,revisionId:'missing'})).status,404);
  assert.equal((await post('/api/artifacts/report/feedback',{...input,message:'x'.repeat(70000)})).status,413);
  const response=await post('/api/artifacts/report/feedback',input);assert.equal(response.status,201);const review=await response.json();assert.equal(review.actor_type,'human');
  fs.writeFileSync(file,'<h1>Second</h1>');const next=store.share(file,{name:'report'});
  assert.match(await (await fetch(origin+`/share/report/?revision=${item.object}`,{headers})).text(),/First/);
  assert.match(await (await fetch(origin+'/share/report/',{headers})).text(),/Second/);
  assert.equal((await fetch(origin+'/api/artifacts/report/revisions',{headers})).status,200);
  assert.equal((await post(`/api/feedback/${review.id}/resolve`,{revisionId:next.object})).status,200);
  assert.equal(store.feedback.thread(review.id).revision_id,item.object);
  assert.equal((await post('/api/subscriptions/new',{})).status,405,'HTTP cannot register arbitrary webhook targets');
});
test('read-only UI cannot write feedback or advance consumers',async t=>{
  const {origin,item}=await fixture(t,{ui:true});
  const response=await fetch(origin+'/api/capabilities');assert.equal((await response.json()).writable,false);
  assert.equal((await fetch(origin+'/api/artifacts/report/feedback',{method:'POST',headers:{'Content-Type':'application/json','X-Tshare-Request':'manage'},body:JSON.stringify({revisionId:item.object,kind:'question',message:'test'})})).status,403);
});
test('signed metadata webhook retries durably after failure and restart, with independent pull acknowledgement',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tshare-hooks-')), db=path.join(root,'db'),file=path.join(root,'r.html');fs.writeFileSync(file,'report');let store=new Store(db);
  let count=0;const received=[],secret='test-only-secret-with-at-least-32-characters';
  const receiver=http.createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);const raw=Buffer.concat(chunks).toString();assert.equal(req.headers['x-tshare-signature'],'sha256='+createHmac('sha256',secret).update(`${req.headers['x-tshare-timestamp']}.${raw}`).digest('hex'));received.push(JSON.parse(raw));res.writeHead(++count===1?503:204);res.end();});
  await new Promise(r=>receiver.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>receiver.close(r));store.close();fs.rmSync(root,{recursive:true,force:true});});
  const item=store.share(file,{name:'r'});store.feedback.subscribe('worker',{artifact:'r',webhookURL:`http://127.0.0.1:${receiver.address().port}/notify`});store.feedback.create('r',{revisionId:item.object,kind:'question',message:'secret review text'});
  assert.deepEqual(await dispatchHooks(store,{secret}),{attempted:1,delivered:0});
  store.close();store=new Store(db);
  assert.equal((await dispatchHooks(store,{secret})).attempted,0,'backoff is persisted');
  store.db.prepare('UPDATE deliveries SET next_attempt=0').run();
  assert.deepEqual(await dispatchHooks(store,{secret}),{attempted:1,delivered:1});
  assert.equal(received[0].event.id,received[1].event.id);assert.ok(!JSON.stringify(received).includes('secret review text'));assert.equal(store.feedback.poll('worker').events.length,1);
  assert.equal((await dispatchHooks(store,{secret})).attempted,0);
});
test('webhook leases prevent concurrent sends and recover an expired crash lease; redirects are not followed',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tshare-lease-')),file=path.join(root,'r.html');fs.writeFileSync(file,'r');const store=new Store(path.join(root,'db'));t.after(()=>{store.close();fs.rmSync(root,{recursive:true,force:true});});
  const item=store.share(file,{name:'r'});store.feedback.subscribe('worker',{webhookURL:'http://127.0.0.1:1/notify'});store.feedback.create('r',{revisionId:item.object,kind:'decision',message:'Proceed.'});
  const secret='test-only-secret-at-least-32-characters';let release;const pending=new Promise(r=>release=r);
  const first=dispatchHooks(store,{secret,fetcher:async(url,options)=>{assert.equal(options.redirect,'error');await pending;return new Response(null,{status:204});}});
  assert.equal((await dispatchHooks(store,{secret})).attempted,0);release();assert.equal((await first).delivered,1);
  store.db.prepare('UPDATE deliveries SET delivered_at=NULL,lease_token=?,lease_until=?,next_attempt=0').run('crashed-worker',Date.now()-1);
  assert.equal((await dispatchHooks(store,{secret,fetcher:async()=>{throw Error('secret must never be saved');}})).delivered,0);
  const row=store.db.prepare('SELECT * FROM deliveries').get();assert.equal(row.attempts,2);assert.equal(row.last_error,'Delivery failed or timed out.');
});
test('historical HTML relative assets remain in the reviewed revision',async t=>{
  const {store,file,origin}=await fixture(t,{ui:true});const dir=path.join(path.dirname(file),'site');fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'index.html'),'<link rel="stylesheet" href="style.css">');fs.writeFileSync(path.join(dir,'style.css'),'/* old */');const first=store.share(dir,{name:'site'});
  fs.writeFileSync(path.join(dir,'style.css'),'/* new */');store.share(dir,{name:'site'});
  const old=await fetch(origin+`/share/site/?revision=${first.object}`);assert.match(old.url,/\/revision\/site\//);assert.match(await(await fetch(new URL('style.css',old.url))).text(),/old/);
  assert.match(await(await fetch(origin+'/share/site/style.css')).text(),/new/);
});
test('real HTTP redirect response is not followed by webhook dispatcher',async t=>{
  const {store,item}=await fixture(t);let followed=0;
  const receiver=http.createServer((req,res)=>{if(req.url==='/redirect'){res.writeHead(302,{Location:'/destination'});}else{followed++;res.writeHead(204);}res.end();});await new Promise(r=>receiver.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>receiver.close(r)));
  store.feedback.subscribe('redirect',{webhookURL:`http://127.0.0.1:${receiver.address().port}/redirect`});store.feedback.create('report',{revisionId:item.object,kind:'question',message:'Test'});
  assert.equal((await dispatchHooks(store,{secret:'test-only-secret-with-at-least-32-characters'})).delivered,0);assert.equal(followed,0);
});
test('outbox failure rolls back feedback and its event together',async t=>{
  const {store,item}=await fixture(t);store.feedback.subscribe('atomic',{webhookURL:'http://127.0.0.1:1/notify'});
  const before=store.feedback.latestCursor();store.db.exec("CREATE TRIGGER fail_delivery BEFORE INSERT ON deliveries BEGIN SELECT RAISE(ABORT,'simulated disk write failure'); END");
  assert.throws(()=>store.feedback.create('report',{revisionId:item.object,kind:'question',message:'Never partially save.'}),/simulated disk write failure/);
  assert.equal(store.feedback.list('report').length,0);assert.equal(store.feedback.latestCursor(),before);assert.equal(store.db.prepare('SELECT count(*) AS n FROM deliveries').get().n,0);
});
