const ALLOWED_LEVELS=new Set(['E0','E1','E2','E3','E4','E5']);
export function portalEvent(eventType,payload,{eventId,occurredAt=new Date().toISOString(),correlationId=null,subjectId=null,evidenceLevel='E0',provenance=[]}={}) {
  if(!eventId) throw new Error('eventId is required for idempotency');
  if(!eventType.startsWith('portal.')) throw new Error('Portal event type must start portal.');
  if(!ALLOWED_LEVELS.has(evidenceLevel)) throw new Error('invalid evidence level');
  return {version:'1.0',event_id:eventId,event_type:eventType,source:'the-portal',occurred_at:occurredAt,correlation_id:correlationId,subject_id:subjectId,evidence_level:evidenceLevel,provenance:[...provenance],payload:{...payload}};
}

export async function emitToPrime(event,{baseUrl=process.env.PRIME_BASE_URL,token=process.env.PRIME_SPINE_TOKEN,fetchImpl=fetch}={}) {
  if(!baseUrl) return {delivered:false,reason:'PRIME_BASE_URL not configured',event};
  if(!token) return {delivered:false,reason:'PRIME_SPINE_TOKEN not configured',event};
  const response=await fetchImpl(`${baseUrl.replace(/\/$/,'')}/api/cognitive/events`,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${token}`},body:JSON.stringify(event)});
  if(!response.ok) throw new Error(`PRIME event delivery failed: ${response.status}`);
  return {delivered:true,response:await response.json()};
}
