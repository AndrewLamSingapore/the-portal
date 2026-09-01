import { strict as assert } from 'node:assert';
import { portalEvent } from './portfolio-events.js';
import { validatePortfolioEvent } from './generated/portfolio-contracts.js';
const event=portalEvent('portal.hypothesis.created',{claim:'x'},{eventId:'portal-hypothesis-1',provenance:['source:1']});
assert.equal(event.source,'the-portal');assert.equal(event.evidence_level,'E0');assert.deepEqual(event.provenance,['source:1']);assert.equal(validatePortfolioEvent(event).valid,true);
console.log('portfolio event tests passed');
