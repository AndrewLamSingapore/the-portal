import assert from 'node:assert/strict';
import { authorized } from '../src/lib/relay-auth.js';

assert.equal(authorized('Bearer relay-secret', 'relay-secret'), true);
assert.equal(authorized('Bearer wrong-secret', 'relay-secret'), false);
assert.equal(authorized('', 'relay-secret'), false);
assert.equal(authorized('Bearer relay-secret', ''), false);
console.log('Portfolio relay authentication: PASS');
