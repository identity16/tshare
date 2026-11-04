// Test-only cluster. Unix socket trust is confined to a new private temp directory.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';import pg from 'pg';
export async function postgres(t) {
 const external=process.env.TSHARE_TEST_ADMIN_URL;
 if(external) {
  const runtime=process.env.TSHARE_TEST_RUNTIME_URL;
  if(!/^tshare_test(?:_|$)/.test(decodeURIComponent(new URL(external).pathname.slice(1)))||!runtime||new URL(runtime).host!==new URL(external).host||new URL(runtime).pathname!==new URL(external).pathname)throw Error('Integration URLs must point to the same dedicated tshare_test database.');
  if(!process.env.TSHARE_TEST_RUNTIME_URL)throw Error('Both dedicated test database URLs are required.');
  const admin=new pg.Pool({connectionString:external,max:1});
  t.after(async()=>{await admin.query('DROP SCHEMA IF EXISTS tshare CASCADE');await admin.end();});
  return {admin,adminOptions:{connectionString:external},runtimeOptions:{connectionString:process.env.TSHARE_TEST_RUNTIME_URL},runtimeRole:process.env.TSHARE_TEST_RUNTIME_ROLE||'tshare_runtime'};
 }
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'tshare-team-db-')),data=path.join(root,'data'),host=path.join(root,'socket');fs.mkdirSync(host,{mode:0o700});let started=false,admin;
 t.after(async()=>{await admin?.end();if(started)execFileSync('pg_ctl',['-D',data,'-m','fast','-w','stop'],{stdio:'pipe'});fs.rmSync(root,{recursive:true,force:true});});
 execFileSync('initdb',['-D',data,'-U','tshare_migrator','-A','trust','--encoding=UTF8','--locale=C'],{stdio:'pipe'});
 execFileSync('pg_ctl',['-D',data,'-l',path.join(root,'postgres.log'),'-o',`-k ${host} -p 55492 -c listen_addresses=''`,'-w','start'],{stdio:'pipe'});started=true;
 const base={host,port:55492,database:'postgres'};admin=new pg.Pool({...base,user:'tshare_migrator',max:1});
 await admin.query('CREATE ROLE tshare_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
 return {admin,adminOptions:{connection:{...base,user:'tshare_migrator'}},runtimeOptions:{connection:{...base,user:'tshare_runtime'}},runtimeRole:'tshare_runtime'};
}
