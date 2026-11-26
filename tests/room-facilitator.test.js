import test from 'node:test';
import assert from 'node:assert/strict';
import { facilitateRoomWithModel } from '../lib/room-facilitator.js';

test('the model facilitator fails closed without a configured key', async () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  await assert.rejects(
    () => facilitateRoomWithModel({ topic: 'Machine ethics', messages: [] }),
    /OPENAI_API_KEY/
  );
  if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous;
});
