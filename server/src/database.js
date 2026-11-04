import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {requestContext,uuid} from './context.js';
const {Pool,escapeIdentifier}=pg;

export async function migrate({connectionString,runtimeRole,connection={}}) {
  if(typeof runtimeRole!=='string'||!runtimeRole||Buffer.byteLength(runtimeRole)>63)throw new TypeError('A valid runtime database role is required.');
  const pool=new Pool({...connection,connectionString,max:1,connectionTimeoutMillis:5000});let client;
  try{
    client=await pool.connect();await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('tshare-team-schema'))");
    const role=await client.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1',[runtimeRole]);
    if(!role.rowCount||role.rows[0].rolsuper||role.rows[0].rolbypassrls)throw Error('Runtime role must exist and must not bypass row security.');
    const current=await client.query('SELECT current_user AS name');
    if(current.rows[0].name===runtimeRole)throw Error('Migration and runtime database roles must differ.');
    const installed=await client.query("SELECT to_regclass('tshare.schema_migrations') AS name");
    if(!installed.rows[0].name)await client.query(await readFile(new URL('../migrations/0001-team-foundation.sql',import.meta.url),'utf8'));
    const versions=await client.query('SELECT version FROM tshare.schema_migrations ORDER BY version');
    if(versions.rows.length!==1||versions.rows[0].version!==1)throw Error('Unsupported team-server schema version.');
    const target=escapeIdentifier(runtimeRole);
    await client.query(`GRANT USAGE ON SCHEMA tshare TO ${target}`);
    await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tshare TO ${target}`);
    await client.query(`GRANT SELECT ON tshare.schema_migrations,tshare.users,tshare.organizations,tshare.memberships,tshare.workspaces,tshare.artifacts,tshare.revisions,tshare.outbox TO ${target}`);
    await client.query(`GRANT INSERT,UPDATE,DELETE ON tshare.memberships,tshare.workspaces,tshare.artifacts TO ${target}`);
    await client.query(`GRANT UPDATE ON tshare.organizations TO ${target}`);
    await client.query(`GRANT INSERT ON tshare.revisions,tshare.outbox TO ${target}`);
    await client.query('COMMIT');return {version:1};
  }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});throw error;}
  finally{client?.release();await pool.end();}
}

// This pool is only for a least-privilege application role. A context is selected
// by authenticated server code; this wrapper does not authenticate its inputs.
export class TeamDatabase {
  #readiness;
  constructor({connectionString,connection={},max=5,onError=()=>{}}) {
    if(!Number.isSafeInteger(max)||max<1||max>50)throw new TypeError('Pool size must be between 1 and 50.');
    this.pool=new Pool({...connection,connectionString,max,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,query_timeout:15000,statement_timeout:10000});
    this.pool.on('error',onError);
  }
  async ready() {
    this.#readiness ??= this.#checkRole();
    await this.#readiness;return this;
  }
  async #checkRole() {
    const role=await this.pool.query(`SELECT r.rolsuper,r.rolbypassrls,
      EXISTS(SELECT 1 FROM pg_roles x WHERE pg_has_role(current_user,x.oid,'MEMBER') AND (x.rolsuper OR x.rolbypassrls)) AS privileged_membership,
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='tshare' AND pg_has_role(current_user,c.relowner,'MEMBER')) AS owns_tables
      FROM pg_roles r WHERE r.rolname=current_user`);
    const flags=role.rows[0];
    if(!flags||flags.rolsuper||flags.rolbypassrls||flags.privileged_membership||flags.owns_tables)throw Error('Use a non-owner runtime role without elevated membership or BYPASSRLS.');
    const {rows}=await this.pool.query('SELECT version FROM tshare.schema_migrations ORDER BY version');
    if(rows.length!==1||rows[0].version!==1)throw Error('Unsupported team-server schema version.');
  }
  async withContext(context,operation) {
    const scope=requestContext(context);return this.#transaction(scope,operation,false);
  }
  async withUser(userId,operation) {
    return this.#transaction({userId:uuid(userId,'user ID'),organizationId:''},operation,true);
  }
  async #transaction(scope,operation,readOnly) {
    if(typeof operation!=='function')throw new TypeError('A transaction operation is required.');
    await this.ready();
    const client=await this.pool.connect();let broken;
    try{
      await client.query(readOnly?'BEGIN READ ONLY':'BEGIN');
      await client.query("SELECT set_config('tshare.user_id',$1,true),set_config('tshare.organization_id',$2,true)",[scope.userId,scope.organizationId]);
      const value=await operation(client,scope);await client.query('COMMIT');return value;
    }catch(error){try{await client.query('ROLLBACK');}catch(rollbackError){broken=rollbackError;}throw error;}
    finally{client.release(broken);}
  }
  async close(){await this.pool.end();}
}
