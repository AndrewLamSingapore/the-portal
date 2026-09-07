(()=>{
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=v=>Array.isArray(v)?v:[];
const clamp=v=>Math.max(0,Math.min(100,Math.round(Number(v)||0)));
const STAGES=['Seed','Hatchling','Explorer','Researcher','Specialist','Sage'];
const NAMES=['Nova','Mori','Kite','Luma','Pico','Sora','Tala','Aster','Mica'];

function cleanStatement(text){return String(text||'').replace(/^Crossover possibility combining\s+[^:]+:\s*/i,'').replace(/^Surprise branch:\s*/i,'').trim()||'An unresolved possibility is waiting for better evidence.'}
function title(text){const words=cleanStatement(text).replace(/^An?\s+/i,'').split(/\s+/).slice(0,6);return words.join(' ').replace(/[,:;.!?]+$/,'')||'Open possibility'}
function score(candidate,data,index){
  const confidence=clamp((Number(candidate.confidence)||0)*100);
  const evidence=clamp(confidence*.72+Math.min(list(candidate.evidence).length*9,28));
  const connections=clamp(Math.min(list(candidate.ancestry?.parent_ids).length*18+list(candidate.ancestry?.operators).length*12+index*3,100));
  const curiosity=clamp(42+Math.min(list(candidate.predictions).length*12+list(candidate.falsifiers).length*10,48));
  const experience=clamp(Math.min((Number(candidate.generation)||1)*16+(data.generations?.length||0)*7,100));
  const overall=(curiosity+confidence+evidence+connections+experience)/5;
  const stage=STAGES[Math.min(STAGES.length-1,Math.floor(overall/17))];
  return{curiosity,knowledge:confidence,evidence,connections,experience,stage,overall};
}
function inhabitants(data){
  const latest=list(data.generations).at(-1)?.population||[];
  const source=latest.length?latest:list(data.result?.population);
  return source.filter(x=>x.state!=='DEAD').slice(0,9).map((candidate,index)=>({candidate,index,name:NAMES[index%NAMES.length],stats:score(candidate,data,index)}));
}
function meter(label,value){return `<div class="meter-row"><span>${esc(label)}</span><span class="meter-track"><i style="width:${clamp(value)}%"></i></span><b>${clamp(value)}</b></div>`}
function reply(action,inhabitant){
  const c=inhabitant.candidate;
  if(action==='talk')return `${inhabitant.name} says: “I am still learning whether ${title(c.statement).toLowerCase()} holds up. The most useful thing you can give me is a better question, not attention.”`;
  if(action==='explore')return `Explore: ${cleanStatement(c.statement)} ${list(c.predictions)[0]?`A prediction to inspect is: ${c.predictions[0]}`:''}`;
  if(action==='knowledge')return `Feed knowledge safely: look for evidence that could challenge this idea. ${list(c.falsifiers)[0]||'No falsifier is currently declared.'} Nothing is accepted merely because a visitor submits it.`;
  return `Quest: compare this possibility with a rival and ask what single observation would separate them. Suggested test: ${c.discriminating_test||'seek a discriminating observation before increasing confidence.'}`;
}
function renderResident(inhabitant,data){
  const {candidate:c,stats:s,name}=inhabitant;
  $('resident').innerHTML=`<div class="creature-space" aria-hidden="true"><div class="creature"><span class="creature-orbit"></span><span class="creature-face">◉‿◉</span></div></div><div class="resident-copy"><p class="resident-stage">${esc(s.stage.toUpperCase())} · ${esc(c.state||'OPEN')} · EVIDENCE-DRIVEN</p><h3 class="resident-name">${esc(name)}</h3><p class="resident-summary">“I am exploring ${esc(title(c.statement).toLowerCase())}. Help me understand what would make this idea stronger—or prove it wrong.”</p><div class="meters">${meter('CURIOSITY',s.curiosity)}${meter('KNOWLEDGE',s.knowledge)}${meter('EVIDENCE',s.evidence)}${meter('CONNECTIONS',s.connections)}${meter('EXPERIENCE',s.experience)}</div><div class="resident-actions"><button type="button" data-action="talk">TALK</button><button type="button" data-action="explore">EXPLORE</button><button type="button" data-action="knowledge">FEED KNOWLEDGE</button><button type="button" data-action="quest">QUEST</button></div><p class="resident-reply" id="residentReply">${esc(name)} is curious, not needy. Leaving The Portal never harms an inhabitant.</p><details><summary>Evidence and machine provenance</summary><p>Lineage ${esc(c.id)} · confidence ${s.knowledge}% · generation ${esc(c.generation||'unknown')} · ${esc(data.generation_mode||'bounded model')}</p><p>${esc(cleanStatement(c.statement))}</p></details></div>`;
  $('resident').querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{$('residentReply').textContent=reply(button.dataset.action,inhabitant)}));
}
function renderQuest(inhabitant){
  const c=inhabitant.candidate;
  $('quest').innerHTML=`<p class="resident-stage">QUEST 01 · DISCRIMINATE, DON'T REWARD</p><h3>What observation would change ${esc(inhabitant.name)}'s mind?</h3><p>${esc(list(c.falsifiers)[0]||'Find a concrete observation that would distinguish this possibility from its strongest alternative.')}</p><p><b>Suggested next test</b><br>${esc(c.discriminating_test||'Compare competing explanations using one observation that changes only one proposed cause.')}</p><p class="quest-boundary">COMPLETION MEANS BETTER EVIDENCE · NO POINTS FOR REPETITION · NO REAL-WORLD AUTHORITY</p><button type="button" id="openEvidence">OPEN THE EVIDENCE LAB ↗</button>`;
  $('openEvidence').addEventListener('click',()=>location.href='/living');
}
function renderGrid(items){$('inhabitantGrid').innerHTML=items.slice(1,7).map(({candidate:c,name,stats:s})=>`<article class="inhabitant-card"><div class="mini-creature" aria-hidden="true">◉‿◉</div><small>${esc(s.stage.toUpperCase())} · ${esc(c.state||'OPEN')}</small><h3>${esc(name)}</h3><p>${esc(title(c.statement))}</p><p>Evidence ${s.evidence}% · Connections ${s.connections}%</p></article>`).join('')||'<p>No additional active inhabitants are visible yet.</p>'}
async function load(){
  const response=await fetch('/api/living',{cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
  const items=inhabitants(data);if(!items.length)throw new Error('No active lineages are available to inhabit the public layer.');
  renderResident(items[0],data);renderQuest(items[0]);renderGrid(items);
  $('inhabitantState').textContent=`${items.length} INHABITANT${items.length===1?'':'S'} AWAKE · ${data.version||'PORTAL'} · REAL-WORLD AUTHORITY BLOCKED`;
}
load().catch(error=>{$('inhabitantState').textContent=`INHABITANTS RESTING · ${error.message}`;$('resident').innerHTML='<p>The friendly layer is temporarily unavailable. The underlying Living Observatory remains the evidence source.</p>';$('quest').innerHTML='<p>No quest is issued without a valid living evidence state.</p>';});
})();
