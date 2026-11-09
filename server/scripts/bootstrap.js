import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {normalizeEmail} from '../src/access.js';
// Operator-only: subject must have been verified from a signed Google ID token.
// Environment is injected privately; values never appear in command-line args.
const {MIGRATION_DATABASE_URL:connectionString,TSHARE_OWNER_SUBJECT:subject,TSHARE_OWNER_EMAIL:rawEmail,TSHARE_ORGANIZATION_NAME:name}=process.env;
const pool=new pg.Pool({connectionString,max:1});let client;
try{
 if(!connectionString||!subject||subject.length>255||!name||!name.trim()||name.trim().length>200)throw Error('configuration');
 const email=normalizeEmail(rawEmail);client=await pool.connect();await client.query('BEGIN');
 await client.query("SELECT pg_advisory_xact_lock(hashtextextended('tshare-identity',0))");
 let user=(await client.query('SELECT user_id,issuer,subject FROM tshare.identities WHERE email=$1',[email])).rows[0];
 if(user&&(user.issuer!=='https://accounts.google.com'||user.subject!==subject))throw Error('identity');
 if(!user){user={user_id:randomUUID()};await client.query('INSERT INTO tshare.users(id,display_name) VALUES($1,$2)',[user.user_id,email.slice(0,100)]);await client.query('INSERT INTO tshare.identities(user_id,issuer,subject,email) VALUES($1,$2,$3,$4)',[user.user_id,'https://accounts.google.com',subject,email]);}
 const organization=randomUUID();
 await client.query('INSERT INTO tshare.organizations(id,name) VALUES($1,$2)',[organization,name.trim()]);
 await client.query("INSERT INTO tshare.memberships(organization_id,user_id,role) VALUES($1,$2,'owner')",[organization,user.user_id]);
 await client.query("SELECT set_config('tshare.user_id',$1,true),set_config('tshare.organization_id',$2,true)",[user.user_id,organization]);
 await client.query('INSERT INTO tshare.workspaces(organization_id,id,name) VALUES($1,$2,$3)',[organization,randomUUID(),'Reports']);
 await client.query('COMMIT');console.log(`Organization created: ${organization}`);
}catch{await client?.query('ROLLBACK').catch(()=>{});console.error('Bootstrap failed. Check verified owner identity, organization and operator credentials.');process.exitCode=1;}
finally{client?.release();await pool.end();}
