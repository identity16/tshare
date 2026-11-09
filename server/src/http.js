import http from 'node:http';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {AccessError,tokenHash} from './access.js';
const sessionName='__Host-tshare_session';
const cookie=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const flowName=state=>'__Host-tshare_flow_'+tokenHash(state).slice(0,24);
function cookies(header=''){
 const result=Object.create(null);
 for(const item of header.split(';')){
  const part=item.trim(),split=part.indexOf('=');if(split<1)continue;
  const name=part.slice(0,split),value=part.slice(split+1);
  if(Object.hasOwn(result,name))throw new AccessError('invalid_request');result[name]=value;
 }
 return result;
}
function equal(left,right){if(typeof left!=='string'||typeof right!=='string')return false;const a=Buffer.from(left),b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b);}
async function body(req,fields=[]){
 const parts=[];let length=0;
 for await(const chunk of req){length+=chunk.length;if(length>8192)throw new AccessError('invalid_request');parts.push(chunk);}
 if(!length)return {};
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw new AccessError('invalid_request');
 let value;try{value=JSON.parse(Buffer.concat(parts));}catch{throw new AccessError('invalid_request');}
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!fields.includes(key)))throw new AccessError('invalid_request');return value;
}
// Bounds abuse per server instance without trusting client-controlled proxy IPs.
// The deployment ingress must additionally enforce a fleet-wide rate policy.
function limiter(){const buckets=new Map();return (key,limit)=>{
 const now=Date.now();let bucket=buckets.get(key);
 if(!bucket||bucket.until<=now){if(buckets.size>=10000){for(const [name,row] of buckets)if(row.until<=now)buckets.delete(name);if(buckets.size>=10000)throw new AccessError('rate_limited');}bucket={until:now+60000,count:0};buckets.set(key,bucket);}
 if(++bucket.count>limit)throw new AccessError('rate_limited');
 };}

export async function createTeamServer({origin,access,oidc,csrfSecret,onError=()=>{}}){
 const base=new URL(origin);
 if(base.protocol!=='https:'||base.pathname!=='/'||base.search||base.hash||base.username||base.password)throw new TypeError('A canonical HTTPS application origin is required.');
 if(typeof csrfSecret!=='string'||Buffer.byteLength(csrfSecret)<32)throw new TypeError('A persistent CSRF secret of at least 32 bytes is required.');
 const csrf=token=>createHmac('sha256',csrfSecret).update('tshare-csrf\0'+token).digest('base64url');
 const limit=limiter();
 const assets=new Map();
 for(const [url,file,type] of [['/app.js','app.js','text/javascript; charset=utf-8'],['/app.css','app.css','text/css; charset=utf-8'],['/','index.html','text/html; charset=utf-8']]){
  try{assets.set(url,{data:await readFile(new URL('../public/'+file,import.meta.url)),type});}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 return http.createServer({requestTimeout:15000,headersTimeout:10000,maxHeaderSize:16384},async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(value===undefined?undefined:JSON.stringify(value));};
  const redirect=location=>{res.writeHead(303,{Location:location});res.end();};
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try{
   if(req.headers.host!==base.host)throw new AccessError('invalid_request');
   if(!req.url?.startsWith('/')||req.url.startsWith('//'))throw new AccessError('invalid_request');
   const url=new URL(req.url,base),path=url.pathname,jar=cookies(req.headers.cookie),token=jar[sessionName];
   limit('requests',1200);
   if(req.method==='GET'&&path==='/healthz'){send(200,{ok:true,service:'tshare-team-access'});return;}
   if(req.method==='GET'&&path==='/auth/google/start'){
    limit('login',30);
    if(Object.keys(jar).filter(name=>name.startsWith('__Host-tshare_flow_')).length>=5)throw new AccessError('rate_limited');
    const flow=await oidc.begin(),state=new URL(flow.authorizationUrl).searchParams.get('state');
    res.setHeader('Set-Cookie',cookie(flowName(state),flow.browserBinding,600));redirect(flow.authorizationUrl);return;
   }
   if(req.method==='GET'&&path==='/auth/google/callback'){
    limit('callback',60);const states=url.searchParams.getAll('state'),state=states[0];
    if(states.length!==1||!state||state.length>512){redirect('/login?error=sign_in_failed');return;}
    const name=flowName(state);res.setHeader('Set-Cookie',cookie(name,'',0));
    try{
     const identity=await oidc.complete(url,{browserBinding:jar[name]}),next=await access.login(identity,token),session=await access.session(next);
     res.setHeader('Set-Cookie',[cookie(name,'',0),cookie(sessionName,next,604800)]);
     redirect(session.invitations.length?'/join':'/teams');
    }catch(error){if(!(error instanceof AccessError)&&error.name!=='AuthenticationError')onError({code:'callback_failed'});redirect('/login?error='+(error.code==='invitation_required'?'invitation_required':'sign_in_failed'));}
    return;
   }
   if(path.startsWith('/api/')){
    const session=await access.session(token);
    if(req.method!=='GET'){
     if(req.headers.origin!==base.origin||!equal(req.headers['x-csrf-token'],csrf(token))){send(403,{error:{code:'csrf_failed'}});return;}
     limit('mutation',120);limit('user:'+session.user.id,30);
    }
    if(path==='/api/v1/session'&&req.method==='GET'){send(200,{...session,csrfToken:csrf(token)});return;}
    if(path==='/api/v1/logout'&&req.method==='POST'){await body(req);await access.logout(token);res.setHeader('Set-Cookie',cookie(sessionName,'',0));send(204);return;}
    const invitation=path.match(/^\/api\/v1\/invitations\/([^/]+)\/accept$/);
    if(invitation&&req.method==='POST'){await body(req);send(200,await access.accept(token,invitation[1]));return;}
    const organization=path.match(/^\/api\/v1\/organizations\/([^/]+)\/(members|invitations)(?:\/([^/]+))?$/);
    if(organization){const [,org,kind,id]=organization;
     if(kind==='members'&&!id&&req.method==='GET'){send(200,await access.members(token,org));return;}
     if(kind==='invitations'&&!id&&req.method==='POST'){const value=await body(req,['email']);send(201,await access.invite(token,org,value.email));return;}
     if(id&&req.method==='DELETE'){await body(req);if(kind==='members')await access.remove(token,org,id);else await access.cancel(token,org,id);send(204);return;}
    }
    send(404,{error:{code:'not_found'}});return;
   }
   if(req.method==='GET'){
    let asset=assets.get(path);
    if(['/login','/join','/teams'].includes(path)||/^\/teams\/[0-9a-f-]+(?:\/members)?$/.test(path))asset=assets.get('/');
    if(asset){res.writeHead(200,{'Content-Type':asset.type});res.end(asset.data);return;}
   }
   send(404,{error:{code:'not_found'}});
  }catch(error){
   const status=error instanceof AccessError?error.status:500;
   if(status===500)onError({code:'request_failed'});
   if(!res.headersSent){if(status===429)res.setHeader('Retry-After','60');send(status,{error:{code:status===500?'internal_error':error.code}});}else res.end();
  }
 });
}
