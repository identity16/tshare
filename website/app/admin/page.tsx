/* eslint-disable @next/next/no-html-link-for-pages -- The landing is a raw HTML route and requires full navigation. */
import './admin.css';
import { env } from 'cloudflare:workers';
import { notFound } from 'next/navigation';
import { requireChatGPTUser } from '../chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Admin() {
  const user=await requireChatGPTUser('/admin');
  if(!env.WAITLIST_OWNER_ID || user.userId!==env.WAITLIST_OWNER_ID) notFound();
  if(!env.DB) return <main><h1>Database unavailable</h1></main>;
  const totals=await env.DB.prepare('SELECT plan,count(*) AS count FROM waitlist GROUP BY plan ORDER BY plan').all<{plan:string;count:number}>();
  const days=await env.DB.prepare('SELECT substr(created_at,1,10) AS day,count(*) AS count FROM waitlist GROUP BY day ORDER BY day DESC LIMIT 30').all<{day:string;count:number}>();
  return <><main className="container legal"><a href="/">tshare</a><h1>Cloud waitlist</h1><p>Owner-only counts from the live database. No visitor analytics are inferred from signup counts.</p><h2>{totals.results.reduce((sum,row)=>sum+row.count,0)} signups</h2><h2>Plan interest</h2><ul>{totals.results.map(row=><li key={row.plan}>{row.plan}: {row.count}</li>)}</ul><h2>Recent signup days</h2><ul>{days.results.map(row=><li key={row.day}>{row.day}: {row.count}</li>)}</ul><p><a href="/api/waitlist/export">Export private entries as JSON</a></p><p>Contains emails and consent records. Keep exports private.</p></main></>;
}
