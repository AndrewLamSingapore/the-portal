import { neon } from '@neondatabase/serverless';
let sqlClient;export function hasDatabase(){return Boolean(process.env.DATABASE_URL)}export function db(){if(!process.env.DATABASE_URL)return null;if(!sqlClient)sqlClient=neon(process.env.DATABASE_URL);return sqlClient}
export async function saveArtifact(a){const sql=db();if(!sql)return false;await sql`insert into artifacts (id,schema_version,year,era,type,title,description,provenance,condition,imagined_future,problem,status,modern_descendant,question,mode,concepts,evidence_level,sources,relationships,experiment,connections,lifecycle,current_phase,recurrence_conditions,realization_signal,created_at) values (${a.id},${a.schema_version},${a.year},${a.era},${a.type},${a.title},${a.description},${a.provenance},${a.condition},${a.imagined_future},${a.problem},${a.status},${a.modern_descendant},${a.question},${a.mode},${JSON.stringify(a.concepts)}::jsonb,${a.evidence_level||'AI-CURATED'},${JSON.stringify(a.sources||[])}::jsonb,${JSON.stringify(a.relationships||[])}::jsonb,${JSON.stringify(a.experiment||{})}::jsonb,${JSON.stringify(a.connections||[])}::jsonb,${JSON.stringify(a.lifecycle||[])}::jsonb,${a.current_phase||'EMERGED'},${JSON.stringify(a.recurrence_conditions||[])}::jsonb,${a.realization_signal||''},${a.created_at}) on conflict(id) do nothing`;return true}
export async function getArtifact(id){const sql=db();if(!sql)return null;const rows=await sql`select * from artifacts where id=${id} limit 1`;return rows[0]||null}export async function findArtifacts({concept,status,limit=30}={}){const sql=db();if(!sql)return[];const n=Math.max(1,Math.min(60,Number(limit)||30));if(concept)return sql`select * from artifacts where concepts ? ${concept} order by year asc limit ${n}`;if(status)return sql`select * from artifacts where status=${status} order by created_at desc limit ${n}`;return sql`select * from artifacts order by created_at desc limit ${n}`}export async function getArtifactVerdicts(id){const sql=db();if(!sql)return null;return sql`select verdict,vote_count from artifact_verdicts where artifact_id=${id}`}export async function castArtifactVerdict(id,v){const sql=db();if(!sql)return null;await sql`insert into artifact_verdicts(artifact_id,verdict,vote_count,updated_at) values(${id},${v},1,now()) on conflict(artifact_id,verdict) do update set vote_count=artifact_verdicts.vote_count+1,updated_at=now()`;return getArtifactVerdicts(id)}
export async function ensureLivingSchema(){const sql=db();if(!sql)return false;await sql`create table if not exists living_runs(id text primary key,sandbox_key text not null,status text not null default 'ACTIVE',generation integer not null default 0,state jsonb not null default '{}'::jsonb,unfinished_questions jsonb not null default '[]'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now())`;await sql`create table if not exists living_events(id bigserial primary key,run_id text not null references living_runs(id) on delete cascade,generation integer not null,event_type text not null,payload jsonb not null default '{}'::jsonb,created_at timestamptz not null default now())`;return true}
export async function loadLatestLivingRun(sandboxKey){const sql=db();if(!sql)return null;await ensureLivingSchema();const rows=await sql`select * from living_runs where sandbox_key=${sandboxKey} order by updated_at desc limit 1`;return rows[0]||null}
export async function saveLivingRun(run){const sql=db();if(!sql)return false;await ensureLivingSchema();await sql`insert into living_runs(id,sandbox_key,status,generation,state,unfinished_questions,updated_at) values(${run.id},${run.sandbox_key},${run.status||'ACTIVE'},${run.generation||0},${JSON.stringify(run.state||{})}::jsonb,${JSON.stringify(run.unfinished_questions||[])}::jsonb,now()) on conflict(id) do update set status=excluded.status,generation=excluded.generation,state=excluded.state,unfinished_questions=excluded.unfinished_questions,updated_at=now()`;return true}
export async function appendLivingEvent(runId,generation,eventType,payload){const sql=db();if(!sql)return false;await ensureLivingSchema();await sql`insert into living_events(run_id,generation,event_type,payload) values(${runId},${generation},${eventType},${JSON.stringify(payload||{})}::jsonb)`;return true}

export async function ensureExperimentResultSchema(){
  const sql=db();if(!sql)return false;
  await sql`create table if not exists experiment_results(
    experiment_id text primary key,
    result_id text not null unique,
    candidate_id text not null,
    result_version integer not null,
    status text not null,
    conclusion text not null,
    result_json jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
  return true
}
export async function getExperimentResult(experimentId){
  const sql=db();if(!sql)return null;
  await ensureExperimentResultSchema();
  const rows=await sql`select * from experiment_results where experiment_id=${experimentId} limit 1`;
  return rows[0]||null
}
export async function saveExperimentResult(result){
  const sql=db();if(!sql)return false;
  await ensureExperimentResultSchema();
  const rows=await sql`insert into experiment_results(
    experiment_id,result_id,candidate_id,result_version,status,conclusion,result_json,updated_at
  ) values(
    ${result.experiment_id},${result.result_id},${result.candidate_id},${result.result_version},
    ${result.status},${result.conclusion},${JSON.stringify(result)}::jsonb,now()
  ) on conflict(experiment_id) do update set
    result_id=excluded.result_id,
    candidate_id=excluded.candidate_id,
    result_version=excluded.result_version,
    status=excluded.status,
    conclusion=excluded.conclusion,
    result_json=excluded.result_json,
    updated_at=now()
  where experiment_results.result_version < excluded.result_version
  returning *`;
  return rows[0]||getExperimentResult(result.experiment_id)
}
export async function listExperimentResults(limit=60){
  const sql=db();if(!sql)return[];
  await ensureExperimentResultSchema();
  const n=Math.max(1,Math.min(60,Number(limit)||60));
  return sql`select result_json from experiment_results order by updated_at desc limit ${n}`
}
