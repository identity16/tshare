import { env } from 'cloudflare:workers';
import { CONSENT_VERSION, hash, isSameOrigin, readBody, reply, validateSignup } from '../../../lib/waitlist';

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return reply(403, { error:'Submit the form from this website.' });
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(415, { error:'Expected a JSON form.' });
    const raw = await readBody(request);
    const data = validateSignup(raw);
    const token = crypto.randomUUID() + crypto.randomUUID();
    // A filled honeypot never reaches storage; its response does not reveal it.
    if (raw.website) return reply(202, {ok:true, removalToken:token});
    if (!env.DB) return reply(503, { error:'Signup is temporarily unavailable. Please try again later.' });
    const now = Date.now(), hour = Math.floor(now / 3600000);
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    // Only an expiring hash is retained for abuse control; no raw address is stored.
    const limitKey = await hash(`waitlist:${hour}:${ip === 'unknown' ? data.email : ip}`);
    const count = await env.DB.prepare('INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(limitKey,now+3600000).first<{count:number}>();
    if ((count?.count || 0) > (ip === 'unknown' ? 3 : 60)) return reply(429, {error:'Too many attempts. Please try again in an hour.'});
    const timestamp = new Date(now).toISOString();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO waitlist (email,plan,use_case,source,consent_version,consent_at,created_at,removal_hash) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING').bind(data.email,data.plan,data.useCase,data.source,CONSENT_VERSION,timestamp,timestamp,await hash(token)),
      env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now),
    ]);
    // Identical response shape for new and existing addresses. Duplicate submissions
    // receive an inert token; they cannot rotate another person's deletion link.
    return reply(202, {ok:true,removalToken:token});
  } catch (error) {
    if (error instanceof SyntaxError) return reply(400,{error:'Check the form and try again.'});
    if (error instanceof Error && /Enter a valid|Choose a plan|agree to receive|Use case must|1,000|too large|Missing request|Check the form/.test(error.message)) return reply(400,{error:error.message});
    // Never return database errors or log form contents.
    return reply(503,{error:'We could not save your signup. Please try again shortly.'});
  }
}
