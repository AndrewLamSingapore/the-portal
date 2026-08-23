const SYSTEM = `You are the curator of The Portal — a cabinet of strange, forgotten, and imagined objects that seem to have anticipated futures before they arrived.

Generate exactly one original catalogue artifact. It should feel discovered rather than invented: materially specific, historically plausible in texture, and evocative of speculative culture from roughly the 1950s–1990s. Never use a real named copyrighted work, character, franchise, author-created object, or direct imitation.

Prioritize surprise and diversity. Vary era, medium, cultural context, purpose, condition, and provenance. Include tactile physical evidence such as paper stock, ink, corrosion, handwriting, packaging, smell, scratches, fading, repairs, or manufacturing marks where appropriate. Avoid generic sci-fi language and repetitive tropes.

The final question must be genuinely unresolved and haunting rather than a discussion prompt. It must begin with What if, Why did, How did, Who, or Where.

Return only the requested structured artifact data.`;

const TYPES = ['PULP FICTION ARTEFACT','FORGOTTEN TECHNOLOGY','IMAGINED WORLD','STRANGE CREATURE','LOST INVENTION','UNCATALOGUED OBJECT','SPECIMEN — UNCLASSIFIED','EXHIBIT FROM THE STACKS'];
const SCHEMA = {type:'object',additionalProperties:false,properties:{era:{type:'string'},type:{type:'string',enum:TYPES},title:{type:'string'},description:{type:'string'},question:{type:'string'},provenance:{type:'string'},condition:{type:'integer',minimum:1,maximum:5}},required:['era','type','title','description','question','provenance','condition']};

// Lightweight per-instance protection. Vercel instances are ephemeral, so this is a safety layer,
// not a substitute for account-level spend limits / firewall controls.
const buckets = globalThis.__portalBuckets || (globalThis.__portalBuckets = new Map());
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 12;
function clientIp(req){return String(req.headers['x-forwarded-for']||req.headers['x-real-ip']||'unknown').split(',')[0].trim();}
function allowed(ip){const now=Date.now();const b=buckets.get(ip);if(!b||now-b.start>=WINDOW_MS){buckets.set(ip,{start:now,count:1});return {ok:true,left:MAX_PER_WINDOW-1};}if(b.count>=MAX_PER_WINDOW)return {ok:false,left:0,retry:Math.ceil((WINDOW_MS-(now-b.start))/1000)};b.count++;return {ok:true,left:MAX_PER_WINDOW-b.count};}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'Archive not configured'});

  const limit=allowed(clientIp(req));
  res.setHeader('X-RateLimit-Limit',String(MAX_PER_WINDOW));
  res.setHeader('X-RateLimit-Remaining',String(limit.left));
  if(!limit.ok){res.setHeader('Retry-After',String(limit.retry));return res.status(429).json({error:'The archive needs time to settle. Try again later.'});}

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),25000);
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify({model:'gpt-5.6-luna',instructions:SYSTEM,input:'Open an unexpected drawer in the archive and catalogue one artifact. Make this entry unlike an obvious science-fiction cliché.',max_output_tokens:900,text:{format:{type:'json_schema',name:'portal_artifact',strict:true,schema:SCHEMA}}})});
    if(!response.ok){const body=await response.text();console.error('OpenAI status',response.status,body.slice(0,500));return res.status(502).json({error:'Archive upstream unavailable'});}
    const data=await response.json();
    const text=(data.output||[]).filter(i=>i.type==='message').flatMap(i=>i.content||[]).filter(i=>i.type==='output_text').map(i=>i.text||'').join('').trim();
    if(!text)throw new Error('OpenAI returned no artifact text');
    const artifact=JSON.parse(text);
    return res.status(200).json(artifact);
  }catch(error){console.error('artifact error',error?.name||error?.message||error);return res.status(error?.name==='AbortError'?504:500).json({error:error?.name==='AbortError'?'Archive timed out':'Archive failure'});}
  finally{clearTimeout(timer);}
}
