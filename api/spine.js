import { validateEnvelope, classifyAction, verificationTemplate, POLICY } from '../lib/spine.js';
import { getSpineTrust, appendSpineEvent, writeSpineAudit } from '../lib/spine-db.js';
import { latestAutonomyDigest, runAutonomyCycle } from '../lib/autonomy.js';

function json(res,status,value){res.status(status).json(value)}
function bearer(req){
  const header=String(req.headers.authorization||'');
  return header.toLowerCase().startsWith('bearer ')?header.slice(7).trim():'';
}
function authorized(req){
  const expected=String(process.env.PORTAL_SPINE_TOKEN||'').trim();
  return Boolean(expected&&bearer(req)===expected);
}
function cronAuthorized(req){
  const expected=String(process.env.CRON_SECRET||'').trim();
  return Boolean(expected&&bearer(req)===expected);
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const route=String(req.query?.route||'action');

  if(route==='autonomy'){
    if(req.method!=='GET'){res.setHeader('Allow','GET');return json(res,405,{error:'Method not allowed.'})}
    if(!cronAuthorized(req)) return json(res,401,{error:'Cron authorization required.'});
    try{
      const result=await runAutonomyCycle();
      return json(res,result.status==='BLOCKED'?503:200,result);
    }catch(error){
      return json(res,500,{error:'Autonomy cycle failed.',detail:String(error?.message||error).slice(0,200)});
    }
  }

  if(route==='autonomy-latest'){
    if(req.method!=='GET'){res.setHeader('Allow','GET');return json(res,405,{error:'Method not allowed.'})}
    if(!authorized(req)) return json(res,401,{error:'Stable Spine authorization required.'});
    try{return json(res,200,{latest:await latestAutonomyDigest()})}
    catch(error){return json(res,500,{error:'Autonomy digest read failed.',detail:String(error?.message||error).slice(0,200)})}
  }

  if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'Method not allowed.'})}
  if(!authorized(req)) return json(res,401,{error:'Stable Spine authorization required.'});
  if(JSON.stringify(req.body||{}).length>131072) return json(res,413,{error:'Request too large.'});

  const envelope=req.body?.action_envelope;
  const invalid=validateEnvelope(envelope);
  if(invalid) return json(res,422,{error:invalid});
  if(envelope.tenant_id!=='personal') return json(res,403,{error:'Portal tenant boundary mismatch.'});

  try{
    const trust=await getSpineTrust(envelope.tenant_id,envelope.action);
    const decision=classifyAction(envelope,trust);
    const verification=verificationTemplate();
    const record={source:'deterministic_portal_policy_engine'};

    if(decision.state===POLICY.PROHIBITED){
      await writeSpineAudit({envelope,decision,executionStatus:'BLOCKED',verification,decisionRecord:record});
      await appendSpineEvent({tenantId:envelope.tenant_id,correlationId:envelope.correlation_id,eventType:'action.prohibited',aggregateId:envelope.idempotency_key,payload:{decision}});
      return json(res,403,{decision,verification});
    }
    if(decision.state===POLICY.GATED){
      await writeSpineAudit({envelope,decision,executionStatus:'PENDING_APPROVAL',verification,decisionRecord:record});
      await appendSpineEvent({tenantId:envelope.tenant_id,correlationId:envelope.correlation_id,eventType:'approval.required',aggregateId:envelope.idempotency_key,payload:{decision}});
      return json(res,202,{decision,status:'PENDING_APPROVAL',verification});
    }

    await writeSpineAudit({envelope,decision,executionStatus:'AUTHORIZED',verification,decisionRecord:record});
    await appendSpineEvent({tenantId:envelope.tenant_id,correlationId:envelope.correlation_id,eventType:'action.authorized',aggregateId:envelope.idempotency_key,payload:{decision}});
    return json(res,200,{decision,status:'AUTHORIZED',verification});
  }catch(error){
    return json(res,500,{error:'Stable Spine evaluation failed.',detail:String(error?.message||error).slice(0,200)});
  }
}
