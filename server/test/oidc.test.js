import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import https from 'node:https';import {execFileSync} from 'node:child_process';import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {createOidc,AuthenticationError} from '../src/oidc.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
class Flows {
 constructor(){this.rows=new Map();}
 async save(flow){this.rows.set(flow.stateHash,flow);}
 async consume(state,binding){const row=this.rows.get(state);if(!row||row.bindingHash!==binding)return null;this.rows.delete(state);return row;}
}
async function provider(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tshare-oidc-')),codes=new Map(),keys=generateKeyPairSync('rsa',{modulusLength:2048}),other=generateKeyPairSync('rsa',{modulusLength:2048});let calls=0;
 fs.writeFileSync(path.join(root,'ssl.cnf'),'[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=127.0.0.1\n[ext]\nsubjectAltName=IP:127.0.0.1\n');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',path.join(root,'key.pem'),'-out',path.join(root,'cert.pem'),'-config',path.join(root,'ssl.cnf')],{stdio:'pipe'});
 const cert=fs.readFileSync(path.join(root,'cert.pem')),key=fs.readFileSync(path.join(root,'key.pem'));let issuer;
 const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 const server=https.createServer({key,cert},async(req,res)=>{
  if(req.url==='/.well-known/openid-configuration'){send(res,200,{issuer,authorization_endpoint:issuer+'/authorize',token_endpoint:issuer+'/token',jwks_uri:issuer+'/jwks',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256'],token_endpoint_auth_methods_supported:['client_secret_post'],code_challenge_methods_supported:['S256']});return;}
  if(req.url==='/jwks'){send(res,200,{keys:[{...keys.publicKey.export({format:'jwk'}),kid:'fixture',alg:'RS256',use:'sig'}]});return;}
  if(req.url!=='/token'){send(res,404,{error:'not_found'});return;}
  calls++;const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=new URLSearchParams(Buffer.concat(chunks).toString()),code=body.get('code'),fixture=codes.get(code);codes.delete(code);
  if(!fixture||body.get('client_id')!=='test-client'||body.get('client_secret')!=='test-client-secret'||createHash('sha256').update(body.get('code_verifier')||'').digest('base64url')!==fixture.url.searchParams.get('code_challenge')){send(res,400,{error:'invalid_grant'});return;}
  const issued=Math.floor(Date.now()/1000),claims={iss:issuer,sub:'fixture-subject',aud:'test-client',iat:issued,exp:issued+300,nonce:fixture.url.searchParams.get('nonce'),email:'Member@Example.test',email_verified:true,name:'Sample member',...fixture.claims};
  const encoded=[{alg:'RS256',kid:'fixture'},claims].map(value=>Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
  const jwt=encoded+'.'+sign('RSA-SHA256',Buffer.from(encoded),fixture.badSignature?other.privateKey:keys.privateKey).toString('base64url');send(res,200,{access_token:'fixture-access-token',token_type:'Bearer',expires_in:300,id_token:jwt});
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));issuer=`https://127.0.0.1:${server.address().port}`;
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});});
 // A test-only pinned CA transport; production uses the platform's HTTPS fetch.
 const fetch=(url,init={})=>new Promise((resolve,reject)=>{const request=https.request(url,{method:init.method,headers:init.headers,ca:cert,signal:init.signal},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:response.statusCode,headers:response.headers})));});request.on('error',reject);request.end(init.body==null?undefined:init.body.toString());});
 return {issuer,fetch,get calls(){return calls;},issue(authorizationUrl,{claims={},badSignature=false}={}){const url=new URL(authorizationUrl),code='code-'+codes.size+'-'+Math.random();codes.set(code,{url,claims,badSignature});return new URL('https://app.example.test/auth/callback?'+new URLSearchParams({code,state:url.searchParams.get('state')}));}};
}

test('OIDC code flow binds the browser, validates provider signatures/claims and returns identity only',async t=>{
 const p=await provider(t),store=new Flows(),client=await createOidc({issuer:p.issuer,clientId:'test-client',clientSecret:'test-client-secret',redirectUri:'https://app.example.test/auth/callback',flowStore:store,fetch:p.fetch});
 await t.test('authorization uses state, nonce and S256 without exposing the browser binding',async()=>{const flow=await client.begin(),url=new URL(flow.authorizationUrl);assert.equal(url.searchParams.get('scope'),'openid email profile');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(url.searchParams.get('state'));assert.ok(url.searchParams.get('nonce'));assert.ok(!flow.authorizationUrl.includes(flow.browserBinding));const identity=await client.complete(p.issue(flow.authorizationUrl),{browserBinding:flow.browserBinding});assert.deepEqual(identity,{issuer:p.issuer,subject:'fixture-subject',email:'member@example.test',displayName:'Sample member'});assert.ok(!('access_token' in identity));assert.equal(store.rows.size,0);});
 await t.test('a copied callback cannot consume a different browser’s flow',async()=>{const flow=await client.begin(),callback=p.issue(flow.authorizationUrl),before=p.calls;await assert.rejects(client.complete(callback,{browserBinding:'x'.repeat(43)}),{code:'invalid_flow'});assert.equal(p.calls,before);assert.equal(store.rows.size,1);await client.complete(callback,{browserBinding:flow.browserBinding});});
 await t.test('callback replays and expired flows never reach the token endpoint',async()=>{const flow=await client.begin(),callback=p.issue(flow.authorizationUrl);await client.complete(callback,{browserBinding:flow.browserBinding});const before=p.calls;await assert.rejects(client.complete(callback,{browserBinding:flow.browserBinding}),{code:'invalid_flow'});const expired=await client.begin(),state=new URL(expired.authorizationUrl).searchParams.get('state');store.rows.get(hash(state)).expiresAt=0;await assert.rejects(client.complete(p.issue(expired.authorizationUrl),{browserBinding:expired.browserBinding}),{code:'invalid_flow'});assert.equal(p.calls,before);});
 await t.test('wrong callback origin, duplicate query fields and wrong state fail closed',async()=>{for(const change of [u=>u.hostname='evil.example.test',u=>u.searchParams.append('state','duplicate'),u=>u.searchParams.set('state','wrong-state')]){const flow=await client.begin(),url=p.issue(flow.authorizationUrl);change(url);await assert.rejects(client.complete(url,{browserBinding:flow.browserBinding}),AuthenticationError);}});
 await t.test('issuer, audience, expiry, nonce and signature failures are rejected without leaking tokens',async()=>{for(const fixture of [{claims:{iss:'https://wrong.example.test'}},{claims:{aud:'different-client'}},{claims:{exp:1}},{claims:{nonce:'wrong-nonce'}},{badSignature:true}]){const flow=await client.begin();await assert.rejects(client.complete(p.issue(flow.authorizationUrl,fixture),{browserBinding:flow.browserBinding}),error=>error instanceof AuthenticationError&&error.code==='provider_response'&&!JSON.stringify(error).includes('fixture-access-token'));}});
 await t.test('unverified emails never become a recognized identity',async()=>{const flow=await client.begin();await assert.rejects(client.complete(p.issue(flow.authorizationUrl,{claims:{email_verified:false}}),{browserBinding:flow.browserBinding}),{code:'unverified_identity'});});
 await t.test('PKCE verifier substitution cannot redeem a code',async()=>{const flow=await client.begin(),state=new URL(flow.authorizationUrl).searchParams.get('state');store.rows.get(hash(state)).codeVerifier='z'.repeat(43);await assert.rejects(client.complete(p.issue(flow.authorizationUrl),{browserBinding:flow.browserBinding}),{code:'provider_response'});});
});
test('insecure issuer configuration and missing flow storage are rejected before discovery',async()=>{
 const base={issuer:'https://accounts.google.com',clientId:'test',clientSecret:'test',redirectUri:'https://app.example.test/auth/callback',flowStore:new Flows()};
 for(const value of ['http://accounts.google.com','https://user:secret@example.com','https://example.com/#fragment'])await assert.rejects(createOidc({...base,issuer:value}),TypeError);
 await assert.rejects(createOidc({...base,flowStore:null}),/one-use/);
});
