import { neon } from '@neondatabase/serverless';

let sqlClient;
export function hasDatabase(){return Boolean(process.env.DATABASE_URL)}
export function db(){if(!process.env.DATABASE_URL)return null;if(!sqlClient)sqlClient=neon(process.env.DATABASE_URL);return sqlClient}
export async function saveArtifact(a){const sql=db();if(!sql)return false;await sql`insert into artifacts (id,schema_version,year,era,type,title,description,provenance,condition,imagined_future,problem,status,modern_descendant,question,mode,concepts,created_at) values (${a.id},${a.schema_version},${a.year},${a.era},${a.type},${a.title},${a.description},${a.provenance},${a.condition},${a.imagined_future},${a.problem},${a.status},${a.modern_descendant},${a.question},${a.mode},${JSON.stringify(a.concepts)}::jsonb,${a.created_at}) on conflict (id) do nothing`;return true}
export async function getArtifact(id){const sql=db();if(!sql)return null;const rows=await sql`select * from artifacts where id=${id} limit 1`;return rows[0]||null}
export async function findArtifacts({concept,status,limit=12}={}){const sql=db();if(!sql)return[];const n=Math.max(1,Math.min(30,Number(limit)||12));if(concept)return sql`select * from artifacts where concepts ? ${concept} order by created_at desc limit ${n}`;if(status)return sql`select * from artifacts where status=${status} order by created_at desc limit ${n}`;return sql`select * from artifacts order by created_at desc limit ${n}`}
