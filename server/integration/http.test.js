import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {randomUUID} from 'node:crypto';
import {postgres} from './postgres.js';import {provider} from '../test-support/oidc-provider.js';
import {migrate,TeamDatabase} from '../src/database.js';import {TeamAccess} from '../src/access.js';import {PgLoginFlows} from '../src/login-flows.js';import {createOidc} from '../src/oidc.js';import {createTeamServer} from '../src/http.js';

test('real OIDC callback, PostgreSQL sessions and HTTP authorization compose without a fixture login route',async t=>{
 const pg=await postgres(t);await migrate({...pg.adminOptions,runtimeRole:pg.runtimeRole});
 const db=new TeamDatabase(pg.runtimeOptions);t.after(()=>db.close());const access=new TeamAccess(db),p=await provider(t),org=randomUUID(),owner=randomUUID();
 await pg.admin.query('INSERT INTO tshare.users(id,display_name) VALUES($1,$2)',[owner,'Owner']);
 await pg.admin.query('INSERT INTO tshare.identities(user_id,issuer,subject,email) VALUES($1,$2,$3,$4)',[owner,p.issuer,'owner','owner@example.test']);
 await pg.admin.query('INSERT INTO tshare.organizations(id,name) VALUES($1,$2)',[org,'Atlas']);
 await pg.admin.query("INSERT INTO tshare.memberships(organization_id,user_id,role) VALUES($1,$2,'owner')",[org,owner]);
 const origin='https://app.example.test';const oidc=await createOidc({issuer:p.issuer,clientId:'test-client',clientSecret:'test-client-secret',redirectUri:origin+'/auth/google/callback',flowStore:new PgLoginFlows(db),fetch:p.fetch});
 const server=await createTeamServer({origin,access,oidc,csrfSecret:'test-only-csrf-secret-not-for-production'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 function request(path,{method='GET',jar={},headers={},body}={}){return new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port:server.address().port,path,method,headers:{Host:'app.example.test',Cookie:Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '),...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const text=Buffer.concat(chunks).toString();for(const item of res.headers['set-cookie']||[]){const [name,value]=item.split(';')[0].split('=');if(value)jar[name]=value;else delete jar[name];}resolve({status:res.statusCode,headers:res.headers,body:res.headers['content-type']?.startsWith('application/json')&&text?JSON.parse(text):text});});});req.on('error',reject);req.end(body);
 });}
 async function login(jar,claims){const start=await request('/auth/google/start',{jar});const callback=p.issue(start.headers.location,{claims});return request(callback.pathname+callback.search,{jar});}
 const ownerJar={},aliceJar={};let csrf,aliceId;
 await t.test('anonymous/session, host injection and missing callback binding fail closed',async()=>{
  assert.equal((await request('/api/v1/session')).status,401);
  assert.equal((await request('/healthz',{headers:{Host:'evil.example.test','X-Forwarded-Host':'app.example.test'}})).status,400);
  const start=await request('/auth/google/start');const callback=p.issue(start.headers.location,{claims:{sub:'owner',email:'owner@example.test'}});
  const copied=await request(callback.pathname+callback.search);assert.equal(copied.headers.location,'/login?error=sign_in_failed');
  assert.equal((await request('/api/v1/session')).status,401);
 });
 await t.test('signed owner login sets secure host-only cookie and per-flow cookie is cleared',async()=>{
  const result=await login(ownerJar,{sub:'owner',email:'owner@example.test'});assert.equal(result.status,303);assert.equal(result.headers.location,'/teams');
  assert.ok(result.headers['set-cookie'].some(c=>c.startsWith('__Host-tshare_session=')&&c.includes('HttpOnly; Secure; SameSite=Lax; Max-Age=604800')&&!c.includes('Domain=')));
  assert.equal(Object.keys(ownerJar).length,1);const session=await request('/api/v1/session',{jar:ownerJar});csrf=session.body.csrfToken;assert.equal(session.body.organizations[0].role,'owner');assert.ok(!JSON.stringify(session.body).includes(ownerJar['__Host-tshare_session']));
 });
 await t.test('origin, CSRF, unknown fields and content types reject invitation writes',async()=>{
  const path=`/api/v1/organizations/${org}/invitations`,valid={Origin:origin,'X-CSRF-Token':csrf,'Content-Type':'application/json'};
  for(const headers of [{},{...valid,Origin:'https://evil.example.test'},{...valid,'X-CSRF-Token':'wrong'}])assert.equal((await request(path,{method:'POST',jar:ownerJar,headers,body:'{"email":"alice@example.test"}'})).status,403);
  assert.equal((await request(path,{method:'POST',jar:ownerJar,headers:valid,body:'{"email":"alice@example.test","role":"owner"}'})).status,400);
  assert.equal((await request(path,{method:'POST',jar:ownerJar,headers:{...valid,'Content-Type':'text/plain'},body:'{"email":"alice@example.test"}'})).status,400);
  assert.equal((await request(path,{method:'POST',jar:ownerJar,headers:valid,body:'{"email":"alice@example.test"}'})).status,201);
 });
 await t.test('invited login, acceptance, owner-only management and next-request revocation',async()=>{
  assert.equal((await login(aliceJar,{sub:'alice',email:'alice@example.test'})).headers.location,'/join');
  const before=await request('/api/v1/session',{jar:aliceJar});aliceId=before.body.user.id;const invite=before.body.invitations[0].id;assert.equal(before.body.organizations.length,0);
  const accept=await request(`/api/v1/invitations/${invite}/accept`,{method:'POST',jar:aliceJar,headers:{Origin:origin,'X-CSRF-Token':before.body.csrfToken}});assert.equal(accept.status,200);
  assert.equal((await request(`/api/v1/organizations/${org}/members`,{jar:aliceJar})).status,403);
  assert.equal((await request(`/api/v1/organizations/${org}/members`,{jar:ownerJar})).status,200);
  const removed=await request(`/api/v1/organizations/${org}/members/${aliceId}`,{method:'DELETE',jar:ownerJar,headers:{Origin:origin,'X-CSRF-Token':csrf}});assert.equal(removed.status,204);
  assert.equal((await request('/api/v1/session',{jar:aliceJar})).body.organizations.length,0);
  assert.equal((await request(`/api/v1/invitations/${invite}/accept`,{method:'POST',jar:aliceJar,headers:{Origin:origin,'X-CSRF-Token':before.body.csrfToken}})).status,410);
 });
 await t.test('outsider, bad signatures and callback replay never grant a session',async()=>{
  const outsider={};assert.equal((await login(outsider,{sub:'outside',email:'outside@example.test'})).headers.location,'/login?error=invitation_required');assert.equal(Object.keys(outsider).length,0);
  const jar={},start=await request('/auth/google/start',{jar}),url=p.issue(start.headers.location,{badSignature:true});assert.equal((await request(url.pathname+url.search,{jar})).headers.location,'/login?error=sign_in_failed');assert.equal(Object.keys(jar).length,0);
  const next=await request('/auth/google/start',{jar}),good=p.issue(next.headers.location,{claims:{sub:'owner',email:'owner@example.test'}});await request(good.pathname+good.search,{jar});assert.equal((await request(good.pathname+good.search,{jar})).headers.location,'/login?error=sign_in_failed');
 });
 await t.test('logout invalidates the copied cookie and clears browser state',async()=>{
  const copied={...ownerJar};assert.equal((await request('/api/v1/logout',{method:'POST',jar:ownerJar,headers:{Origin:origin,'X-CSRF-Token':csrf}})).status,204);
  assert.equal(Object.keys(ownerJar).length,0);assert.equal((await request('/api/v1/session',{jar:copied})).status,401);
 });
});
