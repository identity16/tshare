import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Store } from '../src/store.js';
import { callTool } from '../src/mcp.js';
function fixture(t) { const root=fs.mkdtempSync(path.join(os.tmpdir(),'tshare-mcp-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const file=path.join(root,'report.html');fs.writeFileSync(file,'<h1>Report</h1>');return {root,file,db:path.join(root,'library')}; }
test('MCP agent reads feedback, replies, publishes revision, resolves and explicitly acknowledges',t=>{
  const {file,db}=fixture(t), store=new Store(db);t.after(()=>store.close());
  const original=callTool(store,'artifact_publish',{path:file,name:'report'});
  callTool(store,'feedback_subscribe',{name:'reviewer',artifact:'report'});
  const review=store.feedback.create('report',{revisionId:original.object,kind:'change_request',message:'Explain the assumptions.'});
  const poll=callTool(store,'feedback_poll',{name:'reviewer'});assert.equal(poll.events.length,1);
  assert.equal(callTool(store,'feedback_get',{id:review.id}).revision_id,original.object);
  callTool(store,'feedback_reply',{id:review.id,message:'I will clarify them.'});
  fs.writeFileSync(file,'<h1>Report</h1><p>Assumptions clarified.</p>');
  const next=callTool(store,'artifact_publish',{path:file,name:'report'});
  assert.match(callTool(store,'artifact_read',{name:'report',revisionId:next.object}).text,/clarified/);
  callTool(store,'feedback_resolve',{id:review.id,revisionId:next.object,message:'Added assumptions.'});
  assert.equal(callTool(store,'feedback_poll',{name:'reviewer'}).events.length,1,'agent activity does not retrigger default consumer');
  callTool(store,'feedback_ack',{name:'reviewer',cursor:poll.nextCursor});
  assert.equal(callTool(store,'feedback_poll',{name:'reviewer'}).events.length,0);
  assert.throws(()=>callTool(store,'feedback_reply',{id:review.id,message:'ok',actorType:'human'}),/Invalid actorType/);
});
test('stdio speaks legacy MCP cleanly and rejects stateless discovery instead of claiming unsupported compatibility',t=>{
  const {db}=fixture(t);
  const messages=[{id:1,method:'server/discover'}, {id:2,method:'tools/list'}, {id:3,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}}, {method:'notifications/initialized'}, {id:4,method:'tools/list'}, {id:5,method:'tools/call',params:{name:'artifacts_list',arguments:{}}}];
  const result=spawnSync(process.execPath,['src/cli.js','mcp','--data-dir',db],{encoding:'utf8',input:messages.map(m=>JSON.stringify({jsonrpc:'2.0',...m})).join('\n')+'\n'});
  assert.equal(result.status,0,result.stderr);const replies=result.stdout.trim().split('\n').map(JSON.parse);
  assert.equal(replies.length,5);assert.equal(replies[0].error.code,-32601);assert.equal(replies[1].error.code,-32000);assert.equal(replies[2].result.protocolVersion,'2025-11-25');assert.ok(replies[3].result.tools.some(t=>t.name==='feedback_poll'));assert.deepEqual(JSON.parse(replies[4].result.content[0].text),[]);
});
test('CLI feedback consumer survives independent process invocations',t=>{
  const {db,file}=fixture(t);
  const cli=(...args)=>{const r=spawnSync(process.execPath,['src/cli.js',...args,'--data-dir',db],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
  cli(file,'report');cli('feedback','subscribe','worker');
  const review=JSON.parse(cli('feedback','add','report','--kind','question','--message','Why?'));
  const poll=JSON.parse(cli('feedback','poll','worker'));assert.equal(poll.events[0].feedbackId,review.id);
  cli('feedback','ack','worker',String(poll.nextCursor));assert.equal(JSON.parse(cli('feedback','poll','worker')).events.length,0);
});
test('stdio rejects an unterminated oversized message and preserves UTF-8 across chunks',async t=>{
  const {db}=fixture(t);
  const large=spawnSync(process.execPath,['src/cli.js','mcp','--data-dir',db],{encoding:'utf8',input:'x'.repeat(1048577)});assert.equal(large.status,1);assert.match(large.stderr,/exceeds 1 MiB/);assert.equal(large.stdout,'');
  const {runMCP}=await import('../src/mcp.js');const {Readable,Writable}=await import('node:stream');const store=new Store(db);t.after(()=>store.close());let output='';const message=Buffer.from(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',clientInfo:{name:'테스트',version:'1'}}})+'\n');
  await runMCP(store,Readable.from([...message].map(byte=>Buffer.from([byte]))),new Writable({write(chunk,enc,done){output+=chunk;done();}}));assert.equal(JSON.parse(output).result.protocolVersion,'2025-06-18');
});
