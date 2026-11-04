import test from 'node:test';
import assert from 'node:assert/strict';
import {requestContext} from '../src/context.js';
const id='00000000-0000-4000-8000-000000000001';
test('request context rejects missing, SQL-shaped and malformed identity values before using a pool',()=>{
 for(const value of [undefined,null,'',"'; SET ROLE postgres;--",id+' ',0,'00000000-0000-0000-0000-000000000000']){
  assert.throws(()=>requestContext({organizationId:value,userId:id}),TypeError);
  assert.throws(()=>requestContext({organizationId:id,userId:value}),TypeError);
 }
 assert.throws(()=>requestContext(),TypeError);
});
test('scope uses canonical immutable IDs and ignores caller-supplied authority labels',()=>{
 const scope=requestContext({organizationId:id.toUpperCase(),userId:id,role:'owner',isAdmin:true});
 assert.deepEqual(scope,{organizationId:id,userId:id});assert.ok(Object.isFrozen(scope));
 assert.throws(()=>{scope.userId='another';},TypeError);
});
