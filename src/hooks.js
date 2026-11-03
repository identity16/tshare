import { createHmac, randomUUID } from 'node:crypto';
import { atomic } from './schema.js';

export function signature(secret, timestamp, body) {
  return 'sha256=' + createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex');
}
export async function dispatchHooks(store, { secret, now = Date.now(), limit = 20, fetcher = fetch, timeout = 5000 } = {}) {
  if (typeof secret !== 'string' || secret.length < 32) throw Error('Set TSHARE_WEBHOOK_SECRET to at least 32 characters before dispatching.');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw Error('Invalid dispatch limit.');
  const jobs = atomic(store.db,()=>{
    const rows=store.db.prepare(`SELECT d.*,s.webhook_url FROM deliveries d JOIN subscriptions s ON s.name=d.subscription WHERE d.delivered_at IS NULL AND d.next_attempt<=? AND d.lease_until<=? ORDER BY d.event_id LIMIT ?`).all(now,now,limit);
    for (const job of rows) {
      job.token=randomUUID();
      store.db.prepare('UPDATE deliveries SET lease_token=?,lease_until=?,attempts=attempts+1 WHERE subscription=? AND event_id=?').run(job.token,now + limit*(timeout+1000)+10000,job.subscription,job.event_id);
    }
    return rows;
  });
  let delivered=0;
  for (const job of jobs) {
    const event=store.feedback.event(job.event_id); if (!event) continue;
    const body=JSON.stringify({subscription:job.subscription,event}), timestamp=String(Math.floor(Date.now()/1000));
    let error = null;
    try {
      const response=await fetcher(job.webhook_url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(timeout),headers:{'Content-Type':'application/json','X-Tshare-Event':String(event.id),'X-Tshare-Timestamp':timestamp,'X-Tshare-Signature':signature(secret,timestamp,body)},body});
      await response.body?.cancel();
      if (!response.ok) error=`HTTP ${response.status}`;
    } catch { error='Delivery failed or timed out.'; }
    // A deleted subscription or a reclaimed lease must never be completed by this worker.
    if (error) store.db.prepare('UPDATE deliveries SET lease_token=NULL,lease_until=0,next_attempt=?,last_error=? WHERE subscription=? AND event_id=? AND lease_token=?').run(Date.now()+Math.min(300000,1000*2**Math.min(job.attempts,9)),error,job.subscription,job.event_id,job.token);
    else { const result=store.db.prepare('UPDATE deliveries SET delivered_at=?,lease_token=NULL,lease_until=0,last_error=NULL WHERE subscription=? AND event_id=? AND lease_token=?').run(new Date().toISOString(),job.subscription,job.event_id,job.token);delivered+=Number(result.changes); }
  }
  return {attempted:jobs.length,delivered};
}
export function startHooks(store, options) {
  let stopped=false, timer, active=Promise.resolve();
  const run=()=>{ active=dispatchHooks(store,options).catch(()=>{console.error('tshare: Webhook dispatcher failed; pending events remain queued.');}).finally(()=>{if(!stopped)timer=setTimeout(run,1000);}); };
  run();
  return async()=>{stopped=true;clearTimeout(timer);await active;};
}
