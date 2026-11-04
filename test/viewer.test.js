import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../src/store.js';
import {createServer} from '../src/server.js';
import {viewerType,contentURL,momentURL,timestamp} from '../web/viewer.js';

test('existing file snapshots get video behavior without changing stored kind or version identity',()=>{
  assert.equal(viewerType({kind:'file',entry:'walkthrough.MP4'}),'video');
  assert.equal(viewerType({kind:'file',entry:'clip.webm'}),'video');
  assert.equal(viewerType({kind:'file',entry:'not.mp4.exe'}),'file');
  assert.equal(viewerType({kind:'folder',entry:'video.mp4'}),'folder');
  const item={kind:'file',name:'demo with space',entry:'clip.mp4',reviewRevision:'reviewed-version'};
  const url=new URL(momentURL('https://example.com/?type=video#item=old',item,12.34567)),hash=new URLSearchParams(url.hash.slice(1));
  assert.equal(hash.get('item'),item.name);assert.equal(hash.get('revision'),'reviewed-version');assert.equal(hash.get('t'),'12.346');assert.equal(url.search,'?type=video');
  assert.equal(contentURL(item),'/revision/demo%20with%20space/reviewed-version/clip.mp4');
  for(const invalid of ['NaN','Infinity','-1',undefined,''])assert.equal(timestamp(invalid),0);
});
test('video MIME and byte ranges work with optional UI off and historical file bytes remain pinned',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tshare-video-')),store=new Store(path.join(root,'data')),file=path.join(root,'clip.mp4');fs.writeFileSync(file,'0123456789');
  const first=store.share(file,{name:'clip'});fs.writeFileSync(file,'new-video');store.share(file,{name:'clip'});
  const server=createServer(store);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.close();fs.rmSync(root,{recursive:true,force:true});});
  const response=await fetch(base+`/revision/clip/${first.object}/clip.mp4`,{headers:{Range:'bytes=3-5'}});assert.equal(response.status,206);assert.equal(response.headers.get('content-type'),'video/mp4');assert.equal(response.headers.get('content-range'),'bytes 3-5/10');assert.equal(await response.text(),'345');
  assert.equal((await fetch(base+'/api/artifacts')).status,404);assert.equal(store.get('clip').kind,'file');
});
