import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { Store } from '../src/store.js';

export function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tshare-feedback-'));
  const store = new Store(path.join(root, 'data')), file = path.join(root, 'report.html');
  fs.writeFileSync(file, '<h1>First</h1>');
  t.after(() => { store.close(); fs.rmSync(root, {recursive:true,force:true}); });
  const item = store.share(file, {name:'report'});
  return {root,store,file,item};
}
test('v1 migration retains its current file as revision 1 and refuses unknown future formats', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'tshare-v1-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const object = randomUUID(); fs.mkdirSync(path.join(root,'objects',object),{recursive:true});
  fs.writeFileSync(path.join(root,'objects',object,'index.html'),'legacy');
  const db = new DatabaseSync(path.join(root,'library.sqlite'));
  db.exec('CREATE TABLE artifacts(name TEXT PRIMARY KEY,object TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,kind TEXT NOT NULL,entry TEXT NOT NULL,bytes INTEGER NOT NULL,created_at TEXT NOT NULL);PRAGMA user_version=1;');
  db.prepare('INSERT INTO artifacts VALUES (?,?,?,?,?,?,?,?)').run('old',object,'Old','','html','index.html',6,new Date().toISOString());db.close();
  const store = new Store(root);
  assert.equal(store.revisions('old')[0].id,object);assert.equal(store.get('old').revision,1);
  assert.equal(fs.readFileSync(path.join(root,'objects',object,'index.html'),'utf8'),'legacy');
  assert.deepEqual(store.db.prepare('PRAGMA foreign_key_check').all(),[]);
  store.db.exec('PRAGMA user_version=99');store.close();
  assert.throws(()=>new Store(root),/newer/);
});
test('feedback stays attached to the read revision, resolution links an explicit later revision, repeated resolution is inert', t => {
  const {store,file,item}=fixture(t);
  const thread=store.feedback.create('report',{kind:'change_request',message:'Add the error state',revisionId:item.object,author:'Reviewer'});
  fs.writeFileSync(file,'<h1>Second</h1>');const next=store.share(file,{name:'report',actorType:'agent'});
  assert.equal(store.revision('report',item.object).number,1);assert.equal(next.revision,2);
  store.feedback.reply(thread.id,{message:'Working on it',actorType:'agent'});
  const result=store.feedback.resolve(thread.id,{revisionId:next.object,message:'Added the error state',actorType:'agent'});
  assert.equal(result.revision_id,item.object);assert.equal(result.resolution_revision_id,next.object);assert.equal(result.status,'resolved');assert.equal(result.replies.length,2);
  const cursor=store.feedback.latestCursor();store.feedback.resolve(thread.id,{revisionId:next.object,message:'Added the error state',actorType:'agent'});assert.equal(store.feedback.latestCursor(),cursor);
  assert.throws(()=>store.feedback.resolve(thread.id,{message:'Different answer'}),/differently/);
});
test('default subscriptions ignore agent activity; pull is repeatable until ack and survives process reopening',t=>{
  const {store,root,item}=fixture(t);store.feedback.subscribe('agent',{artifact:'report'});
  const human=store.feedback.create('report',{revisionId:item.object,kind:'question',message:'Why this change?'});
  store.feedback.reply(human.id,{message:'Because of the review',actorType:'agent'});
  store.feedback.reply(human.id,{message:'Please clarify',actorType:'human'});
  const first=store.feedback.poll('agent',1);assert.equal(first.events.length,1);assert.equal(first.hasMore,true);
  assert.deepEqual(first,store.feedback.poll('agent',1));assert.ok(!JSON.stringify(first).includes('Why this change?'));
  store.feedback.ack('agent',first.nextCursor);
  const second=new Store(path.join(root,'data'));
  const remaining=second.feedback.poll('agent');assert.equal(remaining.events.length,1);assert.equal(remaining.events[0].type,'feedback.replied');
  second.feedback.ack('agent',remaining.nextCursor);second.feedback.ack('agent',first.nextCursor);assert.equal(second.feedback.poll('agent').events.length,0);second.close();
  assert.throws(()=>store.feedback.ack('agent',store.feedback.latestCursor()+1),/cursor/);
});
test('subscriptions can recover prior matching events and enqueue metadata-only deliveries atomically',t=>{
  const {store,item}=fixture(t);
  const thread=store.feedback.create('report',{revisionId:item.object,kind:'decision',message:'Private decision text'});
  store.feedback.subscribe('webhook',{artifact:'report',after:0,kinds:['decision'],webhookURL:'http://127.0.0.1:9911/events'});
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM deliveries').get().n,1);
  assert.equal(store.feedback.poll('webhook').events[0].feedbackId,thread.id);
  assert.ok(!JSON.stringify(store.feedback.poll('webhook')).includes('Private decision text'));
  assert.throws(()=>store.feedback.subscribe('webhook',{artifact:'report'}),/different settings/);
  assert.throws(()=>store.feedback.subscribe('bad',{webhookURL:'http://remote.example/'}),/HTTPS/);
  assert.throws(()=>store.feedback.subscribe('bad',{webhookURL:'https://user:password@example.com/'}),/credentials/);
  assert.throws(()=>store.feedback.subscribe('bad',{types:['made.up']}),/event types/);
});
test('invalid feedback cannot create an event or refer to another artifact revision',t=>{
  const {store,file,item}=fixture(t);const other=store.share(file,{name:'other'});const cursor=store.feedback.latestCursor();
  for(const bad of [{revisionId:other.object,kind:'question',message:'bad'},{revisionId:item.object,kind:'unknown',message:'bad'},{revisionId:item.object,kind:'question',message:''},{revisionId:item.object,kind:'question',message:'x'.repeat(10001)}]) assert.throws(()=>store.feedback.create('report',bad));
  assert.equal(store.feedback.list('report').length,0);assert.equal(store.feedback.latestCursor(),cursor);
});
test('deletion removes all revisions, feedback, scoped subscriptions and pending deliveries; name reuse has a fresh identity',t=>{
  const {store,file,item}=fixture(t);store.share(file,{name:'report'});const objects=store.revisions('report').map(r=>r.id);
  store.feedback.subscribe('hook',{artifact:'report',webhookURL:'http://127.0.0.1:9911/'});
  store.feedback.create('report',{revisionId:item.object,kind:'question',message:'question'});
  store.remove('report');
  for(const object of objects)assert.equal(fs.existsSync(path.join(store.root,'objects',object)),false);
  for(const table of ['revisions','feedback','replies','events','subscriptions','deliveries'])assert.equal(store.db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,0);
  assert.notEqual(store.share(file,{name:'report'}).id,item.id);
});
