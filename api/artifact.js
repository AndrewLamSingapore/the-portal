const SYSTEM=`You are the curator of The Portal — an exhibition of strange, forgotten, and imagined objects from the history of science fiction and fantasy. Generate one artifact catalogue entry. It should feel genuinely old and strange, plausibly from roughly the 1950s–1990s, but must NOT be a real named copyrighted work. Make it specific and evocative, with physical texture. Return ONLY valid JSON with: era; type (one of PULP FICTION ARTEFACT, FORGOTTEN TECHNOLOGY, IMAGINED WORLD, STRANGE CREATURE, LOST INVENTION, UNCATALOGUED OBJECT, SPECIMEN — UNCLASSIFIED, EXHIBIT FROM THE STACKS); title; description (2–3 sentences mentioning physical details); question (one lingering unanswerable question starting What if, Why did, How did, Who, or Where); provenance; condition (integer 1–5).`;
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!process.env.ANTHROPIC_API_KEY)return res.status(503).json({error:'Archive not configured'});
 try{
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:900,system:SYSTEM,messages:[{role:'user',content:'Generate a new artifact for the exhibition. Make it surprising.'}]})});
  if(!r.ok){console.error('Anthropic status',r.status);return res.status(502).json({error:'Archive upstream unavailable'})}
  const data=await r.json();
  const text=(data.content||[]).map(x=>x.text||'').join('').replace(/```json|```/g,'').trim();
  const artifact=JSON.parse(text);
  res.setHeader('Cache-Control','no-store');return res.status(200).json(artifact);
 }catch(e){console.error('artifact error',e?.message||e);return res.status(500).json({error:'Archive failure'})}
}