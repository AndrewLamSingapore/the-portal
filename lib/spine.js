export const POLICY = Object.freeze({ AUTO:'AUTO', BOUNDED_AUTO:'BOUNDED_AUTO', GATED:'GATED', PROHIBITED:'PROHIBITED' });
import { validateActionEnvelope } from '../src/lib/generated/portfolio-contracts.js';

const RULES = Object.freeze({
  'portal.crawl': { state: POLICY.AUTO },
  'portal.graph.update': { state: POLICY.AUTO },
  'portal.synthesis.run': { state: POLICY.AUTO },
  'portal.digest.generate': { state: POLICY.AUTO },
  'portal.content.draft': { state: POLICY.AUTO },
  'portal.content.publish': { state: POLICY.GATED, non_graduatable: true },
  'portal.spend': { state: POLICY.GATED, non_graduatable: true }
});

export function validateEnvelope(envelope){
  const result=validateActionEnvelope(envelope);return result.valid?null:result.errors.map(error=>`${error.path||'/'} ${error.message}`).join('; ');
}

export function classifyAction(envelope,trustEntry){
  const base=RULES[envelope.action]||{state:POLICY.GATED};
  if(base.non_graduatable) return {state:base.state,reason:'Platform rule is permanently non-graduatable.'};
  if(trustEntry?.policy_state===POLICY.PROHIBITED) return {state:POLICY.PROHIBITED,reason:'Trust registry prohibits this action.'};
  if(trustEntry?.policy_state===POLICY.GATED) return {state:POLICY.GATED,reason:'Trust registry requires approval.'};
  return {state:base.state,reason:base.state===POLICY.AUTO?'Platform policy permits autonomous internal execution.':'Platform policy requires bounded execution.'};
}

export function verificationTemplate(){return {command:'NOT_SENT',execution:'NOT_VERIFIED',outcome:'PENDING'}}
export { RULES as PORTAL_POLICY_RULES };
