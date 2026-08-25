import assert from 'node:assert/strict';

import { generateArtifact, parseArtifactResponse } from '../lib/artifact-generation.js';

const artifact = {
  era: 'Interwar civic instrumentation',
  year: 1927,
  type: 'FORGOTTEN TECHNOLOGY',
  title: 'The Deliberation Gauge',
  description: 'A plausible brass instrument used to make hesitation visible.',
  provenance: 'AI-curated conceptual reconstruction with no verified source trail.',
  condition: 3,
  imagined_future: 'Public decisions would display uncertainty instead of hiding it.',
  problem: 'Institutions mistook confidence for accuracy.',
  status: 'TOO EARLY',
  modern_descendant: 'Confidence intervals and decision-support dashboards.',
  concepts: ['uncertainty', 'civic systems'],
  question: 'What changes when hesitation becomes inspectable?',
  evidence_level: 'CONCEPTUAL-INFERENCE',
  sources: [],
  relationships: [{ type: 'ECHOED_BY', label: 'Modern uncertainty visualization.' }],
  experiment: { hypothesis: 'Visible uncertainty improves deliberation.', method: 'Show one decision with and without confidence ranges.', success_signal: 'Participants ask more clarifying questions.', failure_signal: 'Discussion quality does not change.' },
  connections: []
};

function response(body) {
  return {
    ok: true,
    status: 200,
    async json() { return body; }
  };
}

function completed(value) {
  return {
    status: 'completed',
    output: [{ content: [{ type: 'output_text', text: value }] }]
  };
}

assert.throws(
  () => parseArtifactResponse({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] }),
  error => error.code === 'incomplete_max_output_tokens' && error.retryable === true
);
assert.throws(
  () => parseArtifactResponse(completed('{"title":"unfinished')),
  error => error.code === 'malformed_json' && error.retryable === true
);
assert.throws(
  () => parseArtifactResponse(completed(JSON.stringify({ ...artifact, concepts: ['only one'] }))),
  error => error.code === 'invalid_schema' && error.retryable === true
);
assert.deepEqual(parseArtifactResponse(completed(JSON.stringify(artifact))), artifact);

let calls = 0;
const recovered = await generateArtifact({
  mode: 'wander',
  fetchImpl: async () => {
    calls += 1;
    if (calls === 1) return response({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] });
    return response(completed(JSON.stringify(artifact)));
  }
});
assert.equal(calls, 2);
assert.deepEqual(recovered, artifact);

console.log('PASS: incomplete, malformed and schema-invalid artifacts are rejected; one retry recovers generation.');
