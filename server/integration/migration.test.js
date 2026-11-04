import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {postgres} from './postgres.js';import {migrate,TeamDatabase} from '../src/database.js';
test('a prior team schema upgrades atomically, repeated migration is inert, and future schemas are refused',async t=>{
 const pg=await postgres(t);await pg.admin.query(await readFile(new URL('../migrations/0001-team-foundation.sql',import.meta.url),'utf8'));
 await pg.admin.query("INSERT INTO tshare.organizations(id,name) VALUES('00000000-0000-4000-8000-000000000001','Preserved organization')");
 assert.deepEqual(await migrate({...pg.adminOptions,runtimeRole:pg.runtimeRole}),{version:2});assert.deepEqual(await migrate({...pg.adminOptions,runtimeRole:pg.runtimeRole}),{version:2});
 assert.equal((await pg.admin.query('SELECT name FROM tshare.organizations')).rows[0].name,'Preserved organization');
 const db=new TeamDatabase(pg.runtimeOptions);try{await db.ready();}finally{await db.close();}
 await pg.admin.query('INSERT INTO tshare.schema_migrations(version) VALUES(99)');
 await assert.rejects(migrate({...pg.adminOptions,runtimeRole:pg.runtimeRole}),/Unsupported/);assert.equal((await pg.admin.query('SELECT count(*)::int AS n FROM tshare.schema_migrations')).rows[0].n,3);
 assert.equal((await pg.admin.query('SELECT name FROM tshare.organizations')).rows[0].name,'Preserved organization');
});
