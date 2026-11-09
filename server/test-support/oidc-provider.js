import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import https from 'node:https';import {execFileSync} from 'node:child_process';import {createHash,generateKeyPairSync,sign} from 'node:crypto';
export async function provider(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tshare-oidc-')),codes=new Map(),keys=generateKeyPairSync('rsa',{modulusLength:2048}),other=generateKeyPairSync('rsa',{modulusLength:2048});let calls=0,browserClaims={};
 fs.writeFileSync(path.join(root,'ssl.cnf'),'[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=127.0.0.1\n[ext]\nsubjectAltName=IP:127.0.0.1\n');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',path.join(root,'key.pem'),'-out',path.join(root,'cert.pem'),'-config',path.join(root,'ssl.cnf')],{stdio:'pipe'});
 const cert=fs.readFileSync(path.join(root,'cert.pem')),key=fs.readFileSync(path.join(root,'key.pem'));let issuer;
 const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 const server=https.createServer({key,cert},async(req,res)=>{
  if(req.url==='/.well-known/openid-configuration'){send(res,200,{issuer,authorization_endpoint:issuer+'/authorize',token_endpoint:issuer+'/token',jwks_uri:issuer+'/jwks',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256'],token_endpoint_auth_methods_supported:['client_secret_post'],code_challenge_methods_supported:['S256']});return;}
  if(req.url.startsWith('/authorize?')){const target=issue(issuer+req.url,{claims:browserClaims});res.writeHead(303,{Location:target.href});res.end();return;}
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
 function issue(authorizationUrl,{claims={},badSignature=false}={}){const url=new URL(authorizationUrl),code='code-'+codes.size+'-'+Math.random();codes.set(code,{url,claims,badSignature});const callback=new URL(url.searchParams.get('redirect_uri'));callback.search=new URLSearchParams({code,state:url.searchParams.get('state')}).toString();return callback;}
 return {issuer,fetch,get calls(){return calls;},issue,cert,key,setIdentity(claims){browserClaims=claims;}};
}
