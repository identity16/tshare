import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { reply } from '../../../../lib/waitlist';
export async function GET() {
  const user = await getChatGPTUser();
  if (!env.WAITLIST_OWNER_ID || !user || user.userId !== env.WAITLIST_OWNER_ID) return reply(403,{error:'Owner access required.'});
  if (!env.DB) return reply(503,{error:'Database unavailable.'});
  const rows = await env.DB.prepare('SELECT email,plan,use_case,source,consent_version,consent_at,created_at FROM waitlist ORDER BY created_at DESC').all();
  return reply(200,{entries:rows.results});
}
