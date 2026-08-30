export const POLICY = Object.freeze({ AUTO:'AUTO', BOUNDED_AUTO:'BOUNDED_AUTO', GATED:'GATED', PROHIBITED:'PROHIBITED' });

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
  const required=['tenant_id','actor_id','actor_type','action','parameters','context','correlation_id','idempotency_key','schema_version','timestamp'];
  if(!envelope||typeof envelope!=='object'||Array.isArray(envelope)) return 'Action envelope is required.';
  for(const field of required) if(envelope[field]===undefined||envelope[field]===null||envelope[field]==='') return `Missing ${field}.`;
  if(String(envelope.schema_version)!=='1') return 'Unsupported action envelope schema version.';
  return null;
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