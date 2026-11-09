import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createOidc,AuthenticationError} from '../src/oidc.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
class Flows {
 constructor(){this.rows=new Map();}
 async save(flow){this.rows.set(flow.stateHash,flow);}
 async consume(state,binding){const row=this.rows.get(state);if(!row||row.bindingHash!==binding)return null;this.rows.delete(state);return row;}
}
import {provider} from '../test-support/oidc-provider.js';

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
