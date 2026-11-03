export const CONSENT_VERSION = '2026-11-03';
export function validateSignup(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('Check the form and try again.');
  const data = value as Record<string, unknown>;
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (!['cloud', 'team', 'self-hosted', 'unsure'].includes(String(data.plan))) throw new Error('Choose a plan interest.');
  if (data.consent !== true && data.consent !== 'on') throw new Error('Please agree to receive the launch update.');
  if (typeof data.useCase !== 'undefined' && typeof data.useCase !== 'string') throw new Error('Use case must be text.');
  const useCase = typeof data.useCase === 'string' ? data.useCase.trim() : '';
  if (useCase.length > 1000) throw new Error('Keep the use case within 1,000 characters.');
  const source = typeof data.source === 'string' ? data.source.slice(0, 100) : 'direct';
  return { email, plan: String(data.plan), useCase, source };
}
export async function hash(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function reply(status: number, value: unknown) {
  return Response.json(value, { status, headers: { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' } });
}
export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') || new URL(request.url).host;
  return request.headers.get('sec-fetch-site') !== 'cross-site' && (!origin || new URL(origin).host === host);
}
export async function readBody(request: Request) {
  // Bound memory even when a client omits or lies about Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing request body.');
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) { const {done, value} = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 8192) { await reader.cancel(); throw new Error('Request is too large.'); } chunks.push(value); }
  const result = new Uint8Array(bytes); let offset=0;
  for (const chunk of chunks) { result.set(chunk,offset); offset+=chunk.length; }
  return JSON.parse(new TextDecoder().decode(result));
}
