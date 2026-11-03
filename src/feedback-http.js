import { fail } from './feedback.js';
export function management(req, password) {
  if (!password) fail('Set TSHARE_PASSWORD to enable browser changes. Use the CLI otherwise.',403);
  if (req.headers['x-tshare-request'] !== 'manage' || req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && ![`http://${req.headers.host}`,`https://${req.headers.host}`].includes(req.headers.origin))) fail('Invalid management request.',403);
}
async function body(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) fail('Use application/json.',415);
  let bytes=0;const chunks=[];
  for await (const chunk of req) {bytes+=chunk.length;if(bytes>65536) fail('Request body exceeds 64 KiB.',413);chunks.push(chunk);}
  let input;try {input=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {fail('Invalid JSON.');}
  if (!input || typeof input!=='object' || Array.isArray(input)) fail('Expected a JSON object.');
  return input;
}
export async function feedbackHTTP(req,res,url,store,{password,json}) {
  const parts=decodeURIComponent(url.pathname).split('/').slice(2), f=store.feedback;
  if (req.method === 'GET' && parts[0] === 'capabilities' && parts.length===1) {json(res,200,{feedback:true,writable:Boolean(password),identity:'shared-owner'});return true;}
  if (parts[0]==='artifacts' && parts.length===3 && ['feedback','revisions'].includes(parts[2])) {
    const name=parts[1];
    if (req.method==='GET') {f.artifact(name);json(res,200,parts[2]==='feedback'?{feedback:f.list(name)}:{revisions:store.revisions(name)});return true;}
    if (req.method==='POST' && parts[2]==='feedback') {management(req,password);const input=await body(req);json(res,201,f.create(name,{...input,actorType:'human'}));return true;}
  }
  if (parts[0]==='feedback' && parts[1]) {
    if(parts.length===2 && req.method==='GET'){json(res,200,f.thread(parts[1]));return true;}
    if(parts.length===3 && req.method==='POST' && ['replies','resolve'].includes(parts[2])){management(req,password);const input={...await body(req),actorType:'human'};json(res,200,parts[2]==='replies'?f.reply(parts[1],input):f.resolve(parts[1],input));return true;}
  }
  if(parts[0]==='subscriptions' && parts.length===3){
    if(parts[2]==='events' && req.method==='GET'){json(res,200,f.poll(parts[1],url.searchParams.has('limit')?Number(url.searchParams.get('limit')):undefined));return true;}
    if(parts[2]==='ack' && req.method==='POST'){management(req,password);json(res,200,f.ack(parts[1],(await body(req)).cursor));return true;}
  }
  return false;
}
