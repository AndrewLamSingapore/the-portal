(()=>{
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORE='portal-living-visit-v2';
let nodes=[];

function readVisit(){try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}}
function writeVisit(snapshot){try{localStorage.setItem(STORE,JSON.stringify({at:Date.now(),snapshot}))}catch{}}
function sentence(text,max=190){const clean=String(text||'').replace(/\s+/g,' ').trim();if(!clean)return 'The system has not yet expressed this possibility clearly.';const first=(clean.match(/^.*?[.!?](?:\s|$)/)||[])[0]||clean;return first.length>max?first.slice(0,max-1).trim()+'…':first.trim();}
function stripMachineAncestry(text){
  let s=String(text||'').replace(/\s+/g,' ').trim();
  for(let i=0;i<8;i++){
    const m=s.match(/^Crossover possibility combining\s+HYP-[^:]+:\s*/i);
    if(!m)break;
    s=s.slice(m[0].length).trim();
  }
  s=s.replace(/^Alternative structure from Unexpected experimental result suggests a new explanatory branch:\s*/i,'');
  s=s.replace(/^Surprise branch:\s*/i,'');
  return s||String(text||'').trim();
}
function titleFrom(text){
  const core=stripMachineAncestry(text).replace(/^An?\s+/i,'').trim();
  const modal=core.split(/\s+(?:may|might|could|can|appears?|suggests?|would|will|is|are)\s+/i)[0].trim();
  let title=(modal.split(/[,:;.!?]/)[0]||core).trim();
  const words=title.split(/\s+/).filter(Boolean);
  if(words.length>7)title=words.slice(0,7).join(' ');
  if(title.length<5)title=core.split(/\s+/).slice(0,6).join(' ');
  return title.charAt(0).toUpperCase()+title.slice(1);
}
function stateLabel(state){return ({LIVING:'Active possibility',CONTESTED:'Contested possibility',REBORN:'Re-emerging possibility',DEAD:'Rejected possibility',FOSSIL:'Archived possibility',EXTINCT:'Rejected possibility'}[state]||'Open possibility');}
function stateMeaning(state){
  return ({
    LIVING:'This explanation is still compatible with the evidence currently shown.',
    CONTESTED:'Evidence or competing explanations are pulling this possibility in different directions.',
    REBORN:'A previously rejected idea has become worth reconsidering because the evidence context changed.',
    DEAD:'This explanation failed a decisive test and is retained only so its failure can be inspected.'
  }[state]||'This possibility remains open to evidence and challenge.');
}
function collect(){return [...document.querySelectorAll('#generations article.lineage')].map((card,i)=>{
  const tag=card.querySelector('.tag')?.textContent||'';
  const id=card.querySelector('h3')?.textContent||`H${i+1}`;
  const ps=[...card.querySelectorAll('p')];
  const raw=ps.find(p=>!p.classList.contains('tag'))?.textContent||'';
  const confidence=(card.textContent.match(/Confidence\s+(\d+)%/)||[])[1]||'0';
  const state=(tag.split('·')[0]||'LIVING').trim();
  const statement=stripMachineAncestry(raw);
  return{id,state,confidence:Number(confidence),raw,statement,title:titleFrom(statement),card,index:i};
});}
function snapshot(){const xs=collect();return{count:xs.length,dead:xs.filter(x=>x.state==='DEAD').length,reborn:xs.filter(x=>x.state==='REBORN').length,contested:xs.filter(x=>x.state==='CONTESTED').length,ids:xs.map(x=>x.id).sort()};}
function changeMessage(current,previous){
  if(!previous)return 'FIRST VISIT · The Observatory will remember what was here so it can explain what changes next time.';
  const dt=Math.max(1,Math.round((Date.now()-previous.at)/60000)),p=previous.snapshot||{};
  const born=current.ids.filter(id=>!(p.ids||[]).includes(id)).length,lost=(p.ids||[]).filter(id=>!current.ids.includes(id)).length;
  if(born||lost||current.dead!==p.dead||current.reborn!==p.reborn||current.contested!==p.contested){
    const parts=[];if(born)parts.push(`${born} new possibilit${born===1?'y':'ies'}`);if(lost)parts.push(`${lost} no longer active`);if(current.contested!==(p.contested||0))parts.push(`${current.contested} currently contested`);if(current.reborn!==(p.reborn||0))parts.push(`${current.reborn} re-emerging`);
    return `SINCE YOUR LAST VISIT · ${dt}m · ${parts.join(' · ')}`;
  }
  return `SINCE YOUR LAST VISIT · ${dt}m · No major structural change. You can still inspect what supports or challenges each possibility.`;
}
function pulseEvents(xs){
  const events=[];
  const contested=xs.find(x=>x.state==='CONTESTED');
  const reborn=xs.find(x=>x.state==='REBORN');
  const dead=xs.find(x=>x.state==='DEAD');
  const active=xs.filter(x=>x.state!=='DEAD').sort((a,b)=>b.confidence-a.confidence);
  if(contested)events.push({time:'NOW',headline:'An explanation is under pressure',text:`${contested.title} has competing evidence or interpretations worth examining.`,id:contested.id});
  else if(active[0])events.push({time:'NOW',headline:'A possibility is currently strongest',text:`${active[0].title} is the most supported active explanation in this contained model.`,id:active[0].id});
  if(reborn)events.push({time:'RECENT',headline:'An old idea is returning',text:`${reborn.title} is being reconsidered because the evidence context changed.`,id:reborn.id});
  else if(active[1])events.push({time:'RECENT',headline:'Another explanation remains viable',text:`${active[1].title} is still alive and can be compared with the leading possibility.`,id:active[1].id});
  if(dead)events.push({time:'MEMORY',headline:'A failed idea was not erased',text:`${dead.title} remains inspectable so the reason it failed cannot be silently rewritten.`,id:dead.id});
  return events;
}
function renderPulse(xs){const panel=$('pulsePanel');if(!panel)return;panel.innerHTML=pulseEvents(xs).map(e=>`<article class="pulse-event"><b>${esc(e.time)}</b><div><strong>${esc(e.headline)}</strong><p>${esc(e.text)}</p></div><button type="button" data-jump="${esc(e.id)}">SEE WHY</button></article>`).join('');panel.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>focusNode(b.dataset.jump,true)));}
function positions(n){const base=[[18,25],[48,17],[78,27],[28,55],[62,49],[84,62],[45,76],[16,78],[70,82]];return Array.from({length:n},(_,i)=>base[i%base.length]);}
function renderField(xs){
  const field=$('livingField');if(!field)return;
  const chosen=xs.slice(0,9),pos=positions(chosen.length);
  field.innerHTML=chosen.map((x,i)=>`<button class="living-node" style="left:${pos[i][0]}%;top:${pos[i][1]}%" data-node="${esc(x.id)}" data-state="${esc(x.state)}" type="button"><b>${esc(x.title)}</b><small>${esc(stateLabel(x.state))}</small></button>`).join('')+`<div class="field-note"><b>TOUCH A POSSIBILITY</b><br><span class="touch-hint">See the idea first. Technical IDs, confidence and ancestry stay one level deeper.</span></div>`;
  field.querySelectorAll('[data-node]').forEach(b=>b.addEventListener('click',()=>focusNode(b.dataset.node,false)));nodes=chosen;
}
function extractDetail(x){const text=x.card.innerText;const find=label=>{const line=text.split('\n').find(s=>s.trim().startsWith(label));return line?line.replace(label,'').trim():'Not declared';};return{prediction:find('Prediction'),falsifier:find('What could falsify it'),kill:find('Hard kill'),next:find('Best next test')};}
function humanWhy(x,d){
  if(d.prediction&&d.prediction!=='Not declared')return `It makes a testable claim: ${sentence(stripMachineAncestry(d.prediction),170)}`;
  return stateMeaning(x.state);
}
function humanChanged(x){
  if(x.state==='CONTESTED')return 'The idea is no longer being treated as a clean explanation; contradictory evidence or a rival interpretation now matters.';
  if(x.state==='REBORN')return 'New context made a previously rejected explanation worth examining again.';
  if(x.state==='DEAD')return 'A decisive falsifier was reached. The idea is retained as a visible failure rather than deleted.';
  return 'The idea remains active because it has not yet crossed its declared falsification boundary.';
}
function focusNode(id,scroll){
  const x=nodes.find(n=>n.id===id)||collect().find(n=>n.id===id);if(!x)return;
  document.querySelectorAll('.living-node').forEach(n=>n.classList.toggle('active',n.dataset.node===id));
  const d=extractDetail(x);
  $('objectPanel').innerHTML=`
    <p class="human-status">${esc(stateLabel(x.state))}</p>
    <h2 class="human-title">${esc(x.title)}</h2>
    <p class="human-summary">${esc(sentence(x.statement,220))}</p>
    <div class="human-grid">
      <section><b>WHAT THIS MEANS</b><p>${esc(stateMeaning(x.state))}</p></section>
      <section><b>WHY IT MATTERS</b><p>${esc(humanWhy(x,d))}</p></section>
      <section><b>WHAT CHANGED</b><p>${esc(humanChanged(x))}</p></section>
    </div>
    <p class="next-label">WHAT CAN I DO NEXT?</p>
    <div class="object-actions"><button type="button" data-action="why">SEE WHY</button><button type="button" data-action="challenge">CHALLENGE IT</button><button type="button" data-action="neighbours">COMPARE NEARBY IDEAS</button><button type="button" data-action="trace">TRACE ITS HISTORY</button></div>
    <p id="objectReaction" class="reaction">Choose what you want to understand next.</p>
    <details class="technical-details"><summary>Technical provenance</summary><div class="technical-body"><p><b>Machine ID</b> ${esc(x.id)}</p><p><b>Lifecycle state</b> ${esc(x.state)}</p><p><b>Model confidence</b> ${x.confidence}%</p><p><b>Raw statement</b> ${esc(x.raw)}</p><p><b>Prediction</b> ${esc(d.prediction)}</p><p><b>Falsifier</b> ${esc(d.falsifier)}</p><p><b>Hard kill</b> ${esc(d.kill)}</p><p><b>Best next test</b> ${esc(d.next)}</p></div></details>`;
  $('objectPanel').querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>react(b.dataset.action,x,d)));
  if(scroll)$('objectPanel').scrollIntoView({behavior:'smooth',block:'center'});
}
function react(action,x,d){
  const out=$('objectReaction');
  if(action==='why')out.innerHTML=`<b>WHY THIS IS HERE</b><br>${esc(humanWhy(x,d))}<br><br><b>WHAT WOULD CHANGE OUR MIND</b><br>${esc(sentence(stripMachineAncestry(d.falsifier),220))}`;
  else if(action==='challenge'){
    out.innerHTML=`<b>CHALLENGE THIS IDEA</b><br>Look for an observation that conflicts with: ${esc(sentence(stripMachineAncestry(d.falsifier),220))}<br><br>The evidence probe below is non-persistent.`;
    $('observation')?.focus();$('observation')?.scrollIntoView({behavior:'smooth',block:'center'});
  } else if(action==='neighbours'){
    const i=nodes.findIndex(n=>n.id===x.id);const near=[nodes[(i+1)%nodes.length],nodes[(i+2)%nodes.length]].filter(Boolean);
    out.innerHTML=`<b>COMPARE WITH</b><br>${near.map(n=>`<button type="button" class="human-link" data-near="${esc(n.id)}">${esc(n.title)}</button>`).join('')}`;
    out.querySelectorAll('[data-near]').forEach(b=>b.addEventListener('click',()=>focusNode(b.dataset.near,true)));
  } else {
    const details=$('technicalLineage');if(details)details.open=true;
    x.card.classList.add('highlight-flash');x.card.scrollIntoView({behavior:'smooth',block:'center'});
    out.innerHTML=`<b>HISTORY OPENED</b><br>The technical lineage below shows where this idea came from and what happened to it over successive generations.`;
    setTimeout(()=>x.card.classList.remove('highlight-flash'),1600);
  }
}
function touchUnknown(){
  const xs=collect().filter(x=>x.state!=='DEAD');if(xs.length<2)return;
  const a=xs[0],b=xs[Math.min(2,xs.length-1)];
  $('unknownResult').hidden=false;
  $('unknownResult').innerHTML=`<p class="human-status">Constructed comparison · not evidence</p><h3>What if these two ideas are connected?</h3><p><b>${esc(a.title)}</b> and <b>${esc(b.title)}</b> are both active enough to compare, but The Portal is not claiming a causal relationship.</p><p><b>Question to explore</b><br>What observation would show that they share a real mechanism rather than merely sounding similar?</p><div class="object-actions"><button type="button" id="inspectGapA">EXPLORE ${esc(a.title)}</button><button type="button" id="inspectGapB">EXPLORE ${esc(b.title)}</button></div><details class="technical-details"><summary>Boundary and machine provenance</summary><div class="technical-body"><p>${esc(a.id)} ↔ ${esc(b.id)}</p><p>CONSTRUCTED ONLY · ARCHIVE UNCHANGED · NO SOURCE MUTATION · NO REAL-WORLD ACTION</p></div></details>`;
  $('inspectGapA').onclick=()=>focusNode(a.id,true);$('inspectGapB').onclick=()=>focusNode(b.id,true);$('unknownResult').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function collapseTechnicalLineage(){
  const generations=$('generations');if(!generations||$('technicalLineage'))return;
  const details=document.createElement('details');details.id='technicalLineage';details.className='technical-section';
  const summary=document.createElement('summary');summary.textContent='Technical lineage and generation history';details.appendChild(summary);
  generations.parentNode.insertBefore(details,generations);details.appendChild(generations);
}
function init(){
  const xs=collect();if(!xs.length)return false;
  collapseTechnicalLineage();
  const cur=snapshot(),prev=readVisit();$('visitChange').textContent=changeMessage(cur,prev);renderPulse(xs);renderField(xs);focusNode(xs[0].id,false);writeVisit(cur);
  $('pulseToggle').addEventListener('click',()=>{const p=$('pulsePanel'),open=p.hidden;p.hidden=!open;$('pulseToggle').setAttribute('aria-expanded',String(open));});
  $('touchUnknown').addEventListener('click',touchUnknown);return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(init()||tries>50)clearInterval(timer)},120);
})();