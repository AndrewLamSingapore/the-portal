import assert from 'node:assert/strict';
import { validateEnvelope, classifyAction, POLICY } from '../lib/spine.js';
const env=(action)=>({tenant_id:'personal',actor_id:'owner',actor_type:'user',action,parameters:{},context:{},correlation_id:'c1',idempotency_key:`i-${action}`,schema_version:'1.0.0',timestamp:new Date().toISOString()});
assert.equal(validateEnvelope(env('portal.crawl')),null);
assert.equal(classifyAction(env('portal.crawl')).state,POLICY.AUTO);
assert.equal(classifyAction(env('portal.content.publish')).state,POLICY.GATED);
assert.equal(classifyAction(env('portal.spend')).state,POLICY.GATED);
assert.equal(classifyAction(env('unknown')).state,POLICY.GATED);
console.log('Portal Stable Spine policy contract: OK');
