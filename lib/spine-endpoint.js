import { validateEnvelope, classifyAction, verificationTemplate, POLICY } from './spine.js';
import { getSpineTrust, appendSpineEvent, writeSpineAudit } from './spine-db.js';
import { latestAutonomyDigest, runAutonomyCycle } from './autonomy.js';

function bearer(req){
  const header=String(req.headers.authorization||'');
  return header.toLowerCase().startsWith('bearer ')?header.slice(7).trim():'';
}
function spineAuthorized(req){
  const expected=String(process.env.PORTAL_SPINE_TOKEN||'').trim();
  return Boolean(expected&&bearer(req)===expected);
}
function cronAuthorized(req){
  const expected=String(process.env.CRON_SECRET||'').trim();
  return Boolean(expected&&bearer(req)===expected);
}

export async function handlePortalSpine(req,res,route='spine'){
  if(route==='autonomy'){
    if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'})}
    if(!cronAuthorized(req)) return res.status(401).json({error:'Cron authorization required.'});
    try{
      const result=await runAutonomyCycle();
      return res.status(result.status==='BLOCKED'?503:200).json(result);
    }catch(error){
      return res.status(500).json({error:'Autonomy cycle failed.',detail:String(error?.message||error).slice(0,200)});
    }
  }
  if(route==='autonomy-latest'){
    if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'})}
    if(!spineAuthorized(req)) return res.status(401).json({error:'Stable Spine authorization required.'});
    try{return res.status(200).json({latest:await latestAutonomyDigest()})}
    catch(error){return res.status(500).json({error:'Autonomy digest read failed.',detail:String(error?.message||error).slice(0,200)})}
  }
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
  if(!spineAuthorized(req)) return res.status(401).json({error:'Stable Spine authorization required.'});
  if(JSON.stringify(req.body||{}).length>131072) return res.status(413).json({error:'Request too large.'});

  const envelope=req.body?.action_envelope;
  const invalid=validateEnvelope(envelope);
  if(invalid) return res.status(422).json({error:invalid});
  if(envelope.tenant_id!=='personal') return res.status(403).json({error:'Portal tenant boundary mismatch.'});
  try{
    const trust=await getSpineTrust(envelope.tenant_id,envelope.action);
    const decision=classifyAction(envelope,trust);
    const verification=verificationTemplate();
    const record={source:'deterministic_portal_policy_engine'};
    if(decision.state===POLICY.PROHIBITED){
      await writeSpineAudit({envelope,decision,executionStatus:'BLOCKED',verification,decisionRecord:record});
      await appendSpineEvent({tenantId:envelope.tenant_id,correlationId:envelope.correlation_id,eventType:'action.prohibited',aggregateId:envelope.idempotency_key,payload:{decision}});
      return res.status(403).json({decision,verification});
    }
    if(decision.state===POLICY.GATED){
      await writeSpineAudit({envelope,decision,executionStatus:'PENDING_APPROVAL',verification,decisionRecord:record});
      await appendSpineEvent({tenantId:envelope.tenant_id,correlationId:envelope.correlation_id,eventType:'approval.required',aggregateId:envelope.idempotency_key,payload:{decision}});
      return res.status(202).json({decision,status:'PENDING_APPROVAL',verification});
    }
    await writeSpineAudit({envelope,decision,executionStatus:'AUTHORIZED',verification,decisionRecord:record});
    await appendSpineEvent({tenantId:envelope.tenant_id,correlationId:envelope.correlation_id,eventType:'action.authorized',aggregateId:envelope.idempotency_key,payload:{decision}});
    return res.status(200).json({decision,status:'AUTHORIZED',verification});
  }catch(error){
    return res.status(500).json({error:'Stable Spine evaluation failed.',detail:String(error?.message||error).slice(0,200)});
  }
}
