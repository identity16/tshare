import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSignup, hash, isSameOrigin } from '../lib/waitlist.ts';
const valid={email:' TEST@EXAMPLE.INVALID ',plan:'cloud',consent:true};
test('normalizes email and keeps optional fields bounded',()=>{assert.deepEqual(validateSignup(valid),{email:'test@example.invalid',plan:'cloud',useCase:'',source:'direct'});assert.throws(()=>validateSignup({...valid,useCase:'x'.repeat(1001)}));});
test('requires a valid plan, explicit consent, and an email',()=>{for(const bad of [{...valid,email:'invalid'},{...valid,consent:false},{...valid,plan:'enterprise'},null])assert.throws(()=>validateSignup(bad));});
test('opaque removal tokens have a stable digest, not plaintext storage',async()=>{const token=crypto.randomUUID()+crypto.randomUUID();assert.equal((await hash(token)).length,64);assert.equal(await hash(token),await hash(token));assert.notEqual(await hash(token),token);});
test('cross-origin submissions are rejected',()=>{assert.equal(isSameOrigin(new Request('https://site.example/api/waitlist',{headers:{origin:'https://other.example'}})),false);assert.equal(isSameOrigin(new Request('https://site.example/api/waitlist',{headers:{origin:'https://site.example'}})),true);});
