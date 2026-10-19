import { createHash } from 'node:crypto';
import { db } from './db.js';
export function validateSearch(params){
  if(params.q!==undefined&&typeof params.q!=='string')return {error:'Query must be a string'};
  const query=(params.q||'').trim();
  if(query.length>256||Buffer.byteLength(query)>1024)return {error:'Query exceeds 256 characters or 1024 bytes'};
  if(params.limit!==undefined&&(typeof params.limit!=='string'||!/^([1-9]|1[0-9]|2[0-4])$/.test(params.limit)))return {error:'Limit must be an integer from 1 to 24'};
  return {query};
}
export async function searchAdmission(req,{sql=db()}={}){
  if(!sql)return {allowed:false,status:503,error:'Search unavailable'};
  // Vercel overwrites this header at ingress. Outside Vercel use the socket address.
  const address=process.env.VERCEL?String(req.headers?.['x-vercel-forwarded-for']||'unknown').split(',')[0].trim():String(req.socket?.remoteAddress||'unknown');
  const key=createHash('sha256').update(address).digest('hex');
  try{
    await sql`create table if not exists portal_search_limits(key text primary key,window_start timestamptz not null,hits integer not null)`;
    // Two fixed rows per active client/global budget; no raw address or query is stored.
    for(const [bucket,limit] of [[key,20],['global',100]]){
      const rows=await sql`insert into portal_search_limits(key,window_start,hits) values(${bucket},date_trunc('minute',now()),1) on conflict(key) do update set hits=case when portal_search_limits.window_start=excluded.window_start then portal_search_limits.hits+1 else 1 end,window_start=excluded.window_start returning hits`;
      if(Number(rows[0]?.hits)>limit)return {allowed:false,status:429,error:'Search rate limit exceeded'};
    }
    return {allowed:true};
  }catch{return {allowed:false,status:503,error:'Search admission unavailable'};}
}
