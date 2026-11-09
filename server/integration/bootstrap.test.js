import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {postgres} from './postgres.js';import {migrate,TeamDatabase} from '../src/database.js';import {TeamAccess} from '../src/access.js';
test('operator bootstrap and auth functions work with a non-superuser migration owner',async t=>{
 let pg,db;const role='tshare_test_owner_'+randomUUID().replaceAll('-','');let database;
 t.after(async()=>{if(!pg)return;await db?.close();await pg.admin.query('DROP SCHEMA IF EXISTS tshare CASCADE');if(database)await pg.admin.query('REVOKE CREATE ON DATABASE \"'+database.replaceAll('\"','\"\"')+'\" FROM '+role);await pg.admin.query('DROP ROLE IF EXISTS '+role);});
 pg=await postgres(t);
 await pg.admin.query(`CREATE ROLE ${role} LOGIN PASSWORD 'test-only-owner-password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
 database=(await pg.admin.query('SELECT current_database() AS name')).rows[0].name;
 await pg.admin.query('GRANT CREATE ON DATABASE "'+database.replaceAll('"','""')+'" TO '+role);
 let connectionString;
 if(pg.adminOptions.connectionString){const url=new URL(pg.adminOptions.connectionString);url.username=role;url.password='test-only-owner-password';connectionString=url.href;}
 else{const {host,port}=pg.adminOptions.connection;const url=new URL('postgresql://'+role+'@localhost/postgres');url.searchParams.set('host',host);url.searchParams.set('port',port);connectionString=url.href;}
 await migrate({connectionString,runtimeRole:pg.runtimeRole});
 const result=execFileSync(process.execPath,[new URL('../scripts/bootstrap.js',import.meta.url).pathname],{encoding:'utf8',env:{...process.env,MIGRATION_DATABASE_URL:connectionString,TSHARE_OWNER_SUBJECT:'bootstrap-owner',TSHARE_OWNER_EMAIL:'owner@example.test',TSHARE_ORGANIZATION_NAME:'Fictional team'}});
 const organization=result.match(/Organization created: ([0-9a-f-]+)/)[1];
 db=new TeamDatabase(pg.runtimeOptions);const access=new TeamAccess(db);const token=await access.login({issuer:'https://accounts.google.com',subject:'bootstrap-owner',email:'owner@example.test',displayName:'Owner'});
 assert.equal((await access.session(token)).organizations[0].id,organization);assert.equal((await access.session(token)).organizations[0].role,'owner');
 const invitation=await access.invite(token,organization,'member@example.test');const member=await access.login({issuer:'https://accounts.google.com',subject:'member',email:'member@example.test',displayName:'Member'});await access.accept(member,invitation.invitation.id);
 assert.equal((await access.session(member)).organizations[0].role,'member');
 assert.equal((await pg.admin.query('SELECT count(*)::int AS n FROM tshare.workspaces')).rows[0].n,1);
});
