import test from 'node:test';
import assert from 'node:assert/strict';
import { submitContribution, listPublishedContributions, moderateContribution } from '../lib/public-contribution.js';

function fakeSql() {
  const rows = new Map();
  const sql = async (strings, ...values) => {
    const text = strings.join('?');
    if (text.includes('create table') || text.includes('create index')) return [];
    if (text.includes('insert into public_contributions')) {
      const [id, kind, body, targetId, consent, hash] = values;
      if ([...rows.values()].some(row => row.content_hash === hash)) return [];
      const row = { id, kind, text: body, target_id: targetId, consent, status: 'PENDING', content_hash: hash };
      rows.set(id, row);
      return [row];
    }
    if (text.includes('select id,kind,text,target_id,created_at from public_contributions')) {
      return [...rows.values()].filter(row => row.status === 'PUBLISHED');
    }
    if (text.includes('update public_contributions set status=')) {
      const id = values[2];
      const row = rows.get(id);
      if (row) { row.status = values[0] === 'PUBLISHED' ? 'PUBLISHED' : 'REJECTED'; row.moderation_reason = values[1]; return [row]; }
      return [];
    }
    return [];
  };
  return { sql, rows };
}

test('contributions require explicit consent', async () => {
  const { sql } = fakeSql();
  assert.equal((await submitContribution(sql, { kind: 'hypothesis', text: 'A new idea', consent: false })).ok, false);
  assert.equal((await submitContribution(sql, { kind: 'hypothesis', text: 'A new idea', consent: true })).ok, true);
});

test('contributions are content-hash deduplicated and moderated before publication', async () => {
  const { sql } = fakeSql();
  const first = await submitContribution(sql, { kind: 'challenge', text: 'Challenge this claim', consent: true });
  const duplicate = await submitContribution(sql, { kind: 'challenge', text: 'Challenge this claim', consent: true });
  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal((await listPublishedContributions(sql)).length, 0);
  const outcome = await moderateContribution(sql, { id: first.id, decision: 'publish' });
  assert.equal(outcome.ok, true);
  assert.equal((await listPublishedContributions(sql)).length, 1);
});

test('moderation rejects invalid decisions', async () => {
  const { sql } = fakeSql();
  assert.equal((await moderateContribution(sql, { id: 'x', decision: 'nope' })).ok, false);
});
