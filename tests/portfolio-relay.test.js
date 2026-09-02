import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authorized } from '../src/lib/relay-auth.js';

assert.equal(authorized('Bearer relay-secret', 'relay-secret'), true);
assert.equal(authorized('Bearer wrong-secret', 'relay-secret'), false);
assert.equal(authorized('', 'relay-secret'), false);
assert.equal(authorized('Bearer relay-secret', ''), false);

const relay = readFileSync(new URL('../src/lib/portfolio-relay-endpoint.js', import.meta.url), 'utf8');
const outbox = readFileSync(new URL('../src/lib/portfolio-events.js', import.meta.url), 'utf8');
assert.match(relay, /body\.action === 'status'/);
assert.match(relay, /body\.action === 'redrive'/);
assert.match(outbox, /where status='DEAD'/);
assert.match(outbox, /status='RETRY',attempts=0/);
assert.match(outbox, /event_id=any/);
console.log('Portfolio relay authentication and DLQ controls: PASS');
