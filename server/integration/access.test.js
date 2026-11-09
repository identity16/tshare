import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {postgres} from './postgres.js';
import {migrate,TeamDatabase} from '../src/database.js';
import {TeamAccess,tokenHash} from '../src/access.js';

test('persistent identities, invitations and sessions enforce team access across connections',async t=>{
 const pg=await postgres(t);await migrate({...pg.adminOptions,runtimeRole:pg.runtimeRole});
 const db=new TeamDatabase({...pg.runtimeOptions,max:3}),other=new TeamDatabase(pg.runtimeOptions);
 t.after(async()=>{await db.close();await other.close();});
 const access=new TeamAccess(db),second=new TeamAccess(other),owner=randomUUID(),org=randomUUID(),birch=randomUUID();
 const identity=(subject,email)=>({issuer:'https://accounts.google.com',subject,email,displayName:subject});
 await pg.admin.query('INSERT INTO tshare.users(id,display_name) VALUES($1,$2)',[owner,'Owner']);
 await pg.admin.query('INSERT INTO tshare.identities(user_id,issuer,subject,email) VALUES($1,$2,$3,$4)',[owner,'https://accounts.google.com','owner','owner@example.test']);
 await pg.admin.query('INSERT INTO tshare.organizations(id,name) VALUES($1,$2),($3,$4)',[org,'Atlas',birch,'Birch']);
 await pg.admin.query("INSERT INTO tshare.memberships(organization_id,user_id,role) VALUES($1,$2,'owner'),($3,$2,'owner')",[org,owner,birch]);
 const ownerToken=await access.login(identity('owner','owner@example.test'));
 let aliceToken,alice,invite;
 await t.test('outsiders cannot enroll and runtime cannot directly read auth tables or helpers',async()=>{
  await assert.rejects(access.login(identity('outsider','outsider@example.test')),{code:'invitation_required'});
  for(const table of ['sessions','identities','invitations'])await assert.rejects(db.pool.query(`SELECT * FROM tshare.${table}`),{code:'42501'});
  await assert.rejects(db.pool.query('SELECT tshare.access_user($1)',[tokenHash(ownerToken)]),{code:'42501'});
  assert.equal((await pg.admin.query('SELECT count(*)::int AS n FROM tshare.identities')).rows[0].n,1);
 });
 await t.test('duplicate invitations race safely and only matching verified identity sees an invite',async()=>{
  const results=await Promise.allSettled([access.invite(ownerToken,org,' Alice@Example.test '),second.invite(ownerToken,org,'alice@example.test')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'invitation_pending');
  invite=results.find(r=>r.status==='fulfilled').value.invitation.id;
  aliceToken=await access.login(identity('alice','alice@example.test'));const session=await access.session(aliceToken);alice=session.user.id;
  assert.equal(session.organizations.length,0);assert.equal(session.invitations[0].id,invite);
  await assert.rejects(access.accept(ownerToken,invite),{code:'not_found'});
 });
 await t.test('concurrent acceptance is idempotent and gives member rights, never owner rights',async()=>{
  const results=await Promise.all([access.accept(aliceToken,invite),second.accept(aliceToken,invite)]);
  assert.equal(results[0].membership.role,'member');assert.deepEqual(results[0],results[1]);
  assert.equal((await access.session(aliceToken)).organizations.length,1);
  await assert.rejects(access.invite(aliceToken,org,'other@example.test'),{code:'owner_required'});
  await assert.rejects(access.members(aliceToken,org),{code:'owner_required'});
 });
 await t.test('identity conflicts cannot link another subject by email; login rotates just the old session',async()=>{
  await assert.rejects(access.login(identity('impostor','alice@example.test')),{code:'identity_conflict'});
  const separateDevice=await second.login(identity('alice','alice@example.test'));
  const rotated=await access.login(identity('alice','alice@example.test'),aliceToken);
  await assert.rejects(access.session(aliceToken),{code:'authentication_required'});
  await access.session(separateDevice);aliceToken=rotated;await access.logout(separateDevice);
  await assert.rejects(second.session(separateDevice),{code:'authentication_required'});
 });
 await t.test('removal is immediate for the selected team and old invitations cannot restore it',async()=>{
  const next=await access.invite(ownerToken,birch,'alice@example.test');await access.accept(aliceToken,next.invitation.id);
  await access.remove(ownerToken,org,alice);
  assert.deepEqual((await access.session(aliceToken)).organizations.map(o=>o.id),[birch]);
  await assert.rejects(access.accept(aliceToken,invite),{code:'invitation_unavailable'});
  assert.equal(await db.withContext({organizationId:org,userId:alice},async client=>(await client.query('SELECT tshare.can_read($1) AS allowed',[org])).rows[0].allowed),false);
  assert.equal(await db.withContext({organizationId:birch,userId:alice},async client=>(await client.query('SELECT tshare.can_read($1) AS allowed',[birch])).rows[0].allowed),true);
  const again=await access.invite(ownerToken,org,'alice@example.test');await access.accept(aliceToken,again.invitation.id);
  assert.equal((await access.session(aliceToken)).organizations.length,2);
 });
 await t.test('cancel, expiry and cross-team IDs cannot grant membership',async()=>{
  const cancelled=await access.invite(ownerToken,org,'cancel@example.test');const token=await access.login(identity('cancel','cancel@example.test'));
  await assert.rejects(access.cancel(ownerToken,birch,cancelled.invitation.id),{code:'not_found'});
  await access.cancel(ownerToken,org,cancelled.invitation.id);
  await assert.rejects(access.accept(token,cancelled.invitation.id),{code:'invitation_unavailable'});
  const expired=await access.invite(ownerToken,org,'cancel@example.test');
  await pg.admin.query("UPDATE tshare.invitations SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.invitation.id]);
  await assert.rejects(access.accept(token,expired.invitation.id),{code:'invitation_unavailable'});
  await access.invite(ownerToken,org,'cancel@example.test');
 });
 await t.test('cancel/accept races serialize on the organization; no revoked invite can create membership',async()=>{
  const invitation=await access.invite(ownerToken,org,'race@example.test');const token=await access.login(identity('race','race@example.test'));
  await Promise.allSettled([access.cancel(ownerToken,org,invitation.invitation.id),second.accept(token,invitation.invitation.id)]);
  const row=(await pg.admin.query('SELECT status,accepted_by FROM tshare.invitations WHERE id=$1',[invitation.invitation.id])).rows[0];
  const session=await access.session(token);
  assert.equal(session.organizations.length,row.status==='accepted'?1:0);
  assert.ok(['accepted','revoked'].includes(row.status));
 });
 await t.test('last owner and expired sessions are rejected at database boundary',async()=>{
  await assert.rejects(access.remove(ownerToken,org,owner),{code:'last_owner'});
  await pg.admin.query("UPDATE tshare.sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[tokenHash(aliceToken)]);
  await assert.rejects(access.session(aliceToken),{code:'authentication_required'});
  await assert.rejects(access.members(aliceToken,org),{code:'authentication_required'});
  assert.equal((await pg.admin.query("SELECT count(*)::int AS n FROM tshare.sessions WHERE token_hash !~ '^[0-9a-f]{64}$'")).rows[0].n,0);
 });
});
