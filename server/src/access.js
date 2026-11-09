import {createHash,randomBytes} from 'node:crypto';
import {uuid} from './context.js';
export const tokenHash=value=>createHash('sha256').update(value).digest('hex');
export const newToken=()=>randomBytes(32).toString('base64url');
const statuses={authentication_required:401,invitation_required:403,identity_conflict:409,membership_required:403,owner_required:403,not_found:404,invitation_unavailable:410,already_member:409,invitation_pending:409,last_owner:409,invalid_request:400,rate_limited:429};
export class AccessError extends Error {
  constructor(code){super(code);this.name='AccessError';this.code=code;this.status=statuses[code]||500;}
}
export function normalizeEmail(value){
  if(typeof value!=='string')throw new AccessError('invalid_request');
  const email=value.trim().toLowerCase();
  if(email.length>320||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new AccessError('invalid_request');
  return email;
}
const hash=token=>typeof token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(token)?tokenHash(token):'0'.repeat(64);
const id=value=>{try{return uuid(value);}catch{throw new AccessError('invalid_request');}};
// These SQL calls are fixed, scoped entry points. No arbitrary SQL from HTTP.
export class TeamAccess {
  constructor(database){this.database=database;}
  async call(name,values){
    await this.database.ready();
    const calls={login:'SELECT tshare.access_login($1,$2,$3,$4,$5,$6) AS value',session:'SELECT tshare.access_session($1) AS value',logout:'SELECT tshare.access_logout($1) AS value',accept:'SELECT tshare.access_accept($1,$2) AS value',invite:'SELECT tshare.access_invite($1,$2,$3) AS value',members:'SELECT tshare.access_members($1,$2) AS value',cancel:'SELECT tshare.access_cancel($1,$2,$3) AS value',remove:'SELECT tshare.access_remove($1,$2,$3) AS value'};
    if(!calls[name])throw new TypeError('Unknown access operation.');
    try{return (await this.database.pool.query(calls[name],values)).rows[0].value;}
    catch(error){if(error.code==='P0001'&&Object.hasOwn(statuses,error.message))throw new AccessError(error.message);throw error;}
  }
  async login(identity,oldToken){
    const token=newToken();
    await this.call('login',[identity.issuer,identity.subject,normalizeEmail(identity.email),identity.displayName,hash(token),hash(oldToken)]);
    return token;
  }
  session(token){return this.call('session',[hash(token)]);}
  logout(token){return this.call('logout',[hash(token)]);}
  accept(token,invitation){return this.call('accept',[hash(token),id(invitation)]);}
  invite(token,organization,email){return this.call('invite',[hash(token),id(organization),normalizeEmail(email)]);}
  members(token,organization){return this.call('members',[hash(token),id(organization)]);}
  cancel(token,organization,invitation){return this.call('cancel',[hash(token),id(organization),id(invitation)]);}
  remove(token,organization,user){return this.call('remove',[hash(token),id(organization),id(user)]);}
}
