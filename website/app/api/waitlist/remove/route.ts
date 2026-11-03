import { env } from 'cloudflare:workers';
import { hash, isSameOrigin, readBody, reply } from '../../../../lib/waitlist';
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return reply(403,{error:'Open your removal link on this website.'});
    const data = await readBody(request);
    if (typeof data.token !== 'string' || !/^[a-f0-9-]{72}$/.test(data.token)) return reply(400,{error:'Use the complete removal link from your signup.'});
    if (!env.DB) return reply(503,{error:'Removal is temporarily unavailable. Try again later.'});
    await env.DB.prepare('DELETE FROM waitlist WHERE removal_hash=?').bind(await hash(data.token)).run();
    return reply(200,{ok:true});
  } catch { return reply(503,{error:'Removal did not complete. Please try again later.'}); }
}
