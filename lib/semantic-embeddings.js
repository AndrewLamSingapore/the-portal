import { createHash } from 'node:crypto';
import { db } from './db.js';

const DEFAULT_MODEL='text-embedding-3-small';
const hash=value=>createHash('sha256').update(value).digest('hex');
export const nodeText=node=>[node.label,node.title,node.name,node.summary,node.description,node.type].filter(Boolean).join(' ');

async function openAiEmbed(texts,{fetchImpl=fetch,model=process.env.PORTAL_EMBEDDING_MODEL||DEFAULT_MODEL}={}){
  const key=String(process.env.OPENAI_API_KEY||'').trim();if(!key)throw new Error('OPENAI_API_KEY not configured for semantic retrieval');
  const response=await fetchImpl('https://api.openai.com/v1/embeddings',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${key}`},body:JSON.stringify({model,input:texts,encoding_format:'float'})});
  if(!response.ok)throw new Error(`embedding request failed: ${response.status}`);
  const body=await response.json();const vectors=(body.data||[]).sort((a,b)=>a.index-b.index).map(item=>item.embedding);
  if(vectors.length!==texts.length||vectors.some(vector=>!Array.isArray(vector)||!vector.length))throw new Error('embedding response was incomplete');
  return vectors;
}

export async function semanticScores(query,nodes,{fetchImpl=fetch,embedder=openAiEmbed}={}){
  const model=process.env.PORTAL_EMBEDDING_MODEL||DEFAULT_MODEL;const sql=db();
  if(!sql)return {scores:new Map(),status:{mode:'lexical_fallback',degraded:true,reason:'DATABASE_URL not configured',model}};
  try{
    await sql`create table if not exists semantic_embeddings(entity_id text not null,model text not null,content_hash text not null,vector_json jsonb not null,updated_at timestamptz not null default now(),primary key(entity_id,model))`;
    const ids=nodes.map(node=>String(node.id));const rows=ids.length?await sql`select entity_id,content_hash,vector_json from semantic_embeddings where model=${model} and entity_id=any(${ids}::text[])`:[];const cached=new Map(rows.map(row=>[row.entity_id,row]));
    const missing=nodes.filter(node=>cached.get(String(node.id))?.content_hash!==hash(nodeText(node)));const inputs=[query,...missing.map(nodeText)];const vectors=await embedder(inputs,{fetchImpl,model});const queryVector=vectors[0];
    for(let index=0;index<missing.length;index+=1){const node=missing[index];const vector=vectors[index+1];const contentHash=hash(nodeText(node));cached.set(String(node.id),{content_hash:contentHash,vector_json:vector});await sql`insert into semantic_embeddings(entity_id,model,content_hash,vector_json,updated_at) values(${String(node.id)},${model},${contentHash},${JSON.stringify(vector)}::jsonb,now()) on conflict(entity_id,model) do update set content_hash=excluded.content_hash,vector_json=excluded.vector_json,updated_at=now()`;}
    const scores=new Map(nodes.map(node=>[node.id,cosine(queryVector,cached.get(String(node.id))?.vector_json||[])]));
    return {scores,status:{mode:'persistent_embedding_rerank',degraded:false,reason:null,model,indexed:missing.length,cached:nodes.length-missing.length}};
  }catch(error){return {scores:new Map(),status:{mode:'lexical_fallback',degraded:true,reason:String(error?.message||error).slice(0,160),model}};}
}

export function cosine(left,right){if(!left?.length||left.length!==right?.length)return 0;let dot=0,a=0,b=0;for(let index=0;index<left.length;index+=1){dot+=left[index]*right[index];a+=left[index]**2;b+=right[index]**2}return a&&b?dot/Math.sqrt(a*b):0;}
