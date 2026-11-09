import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {createTeamServer} from '../src/http.js';import {AccessError} from '../src/access.js';
test('HTTP configuration, cookie ambiguity and bounded auth admission fail closed',async t=>{
 const base={origin:'https://app.example.test',access:{async session(){throw new AccessError('authentication_required');}},oidc:{},csrfSecret:'test-only-persistent-secret-of-more-than-32-bytes'};
 await assert.rejects(createTeamServer({...base,origin:'http://app.example.test'}));await assert.rejects(createTeamServer({...base,csrfSecret:'short'}));
 let calls=0;const server=await createTeamServer({...base,oidc:{async begin(){calls++;return {authorizationUrl:'https://provider.example.test/authorize?state=fixture-'+calls,browserBinding:'fixture-binding'};}}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=(path,headers={})=>new Promise((resolve,reject)=>{const req=http.get({host:'127.0.0.1',port:server.address().port,path,headers:{Host:'app.example.test',...headers}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,headers:res.headers}));});req.on('error',reject);});
 assert.equal((await request('/api/v1/session',{Cookie:'__Host-tshare_session=one; __Host-tshare_session=two'})).status,400);
 assert.equal((await request('/healthz')).status,200);
 assert.equal((await request('/login')).headers['content-security-policy'].includes("frame-ancestors 'none'"),true);
 for(let i=0;i<30;i++)assert.equal((await request('/auth/google/start')).status,303);
 const denied=await request('/auth/google/start');assert.equal(denied.status,429);assert.equal(denied.headers['retry-after'],'60');assert.equal(calls,30);
});
