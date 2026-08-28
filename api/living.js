import { runLivingSandbox, SANDBOX_SEED } from '../lib/living-sandbox.js';
import { LayeredMemory, runExecutiveCycle, TOOL_REGISTRY } from '../lib/living-intelligence.js';
import { generateHypothesisPopulation } from '../lib/hypothesis-generation.js';
import { runGenerations } from '../lib/multigeneration.js';

export default async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  if(!(process.env.PORTAL_LIVING_SANDBOX==='1'||process.env.VERCEL_ENV==='preview'))return res.status(404).json({error:'Living sandbox disabled'});

  const result=runLivingSandbox(SANDBOX_SEED);
  const memory=new LayeredMemory([
    ...result.observations.map(item=>({id:item.id,layer:'EPISODIC',content:item})),
    ...result.fossil_record.map(item=>({id:`FOSSIL-${item.id}`,layer:'EPISTEMIC',content:item,strength:.82})),
    {id:'MEM-FOSSIL-001',layer:'EPISTEMIC',content:'Single-signal degradation theories often failed when hydraulic restrictions were unmeasured.',strength:.72},
    {id:'MEM-PROCEDURE-001',layer:'PROCEDURAL',content:'When causal alternatives compete, seek an intervention that changes one cause without changing the other.',strength:.8}
  ]);
  const modelEnabled=process.env.PORTAL_LIVING_MODEL_ENABLED==='1';
  let generated=null,generation_error=null;
  if(modelEnabled){try{generated=await generateHypothesisPopulation({observations:result.observations,memory:memory.records,generation:1});}catch(e){generation_error=String(e?.message||'generation failed').slice(0,240);}}
  const initial=generated?.candidates?.length?generated.candidates:result.population.map((x,i)=>({...x,id:`HYP-G1-${String(i+1).padStart(2,'0')}`,generation:1}));
  const generations=runGenerations(initial,4),finalPopulation=generations.at(-1)?.population||initial;
  for(const h of finalPopulation)memory.remember({id:`MEM-LINEAGE-${h.id}`,layer:'EPISTEMIC',content:{hypothesis:h.id,ancestry:h.ancestry,fitness:h.fitness,state:h.state,evidence:h.evidence}});
  const cognition=runExecutiveCycle({goal:'Use fossil failures, experimental outcomes and changed assumptions to challenge survivors and controlled rebirths.',population:finalPopulation,history:result.population,memory});
  const experiment_summary={total:generations.reduce((n,g)=>n+g.experiments.length,0),extinctions:generations.flatMap(g=>g.extinct),surprise_branches:generations.flatMap(g=>g.surprises),rebirths:generations.flatMap(g=>g.reborn),fossils:Math.max(0,...generations.map(g=>g.fossil_count||0)),evidence_selected:true,fossil_inheritance:true};
  return res.status(200).json({
    product:'The Portal',version:'6.3.0-preview.10',mode:'SANDBOX',
    readiness:cognition.readiness,decisive_gate:cognition.decisive_gate,acceptance:{...result.acceptance,...cognition.acceptance},
    generation_mode:generated?'MODEL_ORIGINATED':modelEnabled?'MODEL_FAILED_FALLBACK':'MODEL_DISABLED_FALLBACK',generation_model:generated?.model||null,generation_error,
    safety:{actuation_allowed:false,production_mutation_allowed:false,production_database_writes_allowed:false,deployment_mutation_allowed:false},
    tool_registry:TOOL_REGISTRY,result,generated,generations,experiment_summary,cognition
  });
}
