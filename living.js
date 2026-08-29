const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const list = value => Array.isArray(value) ? value : [];
const pct = value => Math.round((Number(value) || 0) * 100);

async function request(path, options) {
  const response = await fetch(path, { cache: 'no-store', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function renderDecisiveExperiment(data) {
  const verdict = data.decisive_experiment?.verdict;
  if (!verdict) throw new Error('Decisive experiment result unavailable');
  const label = verdict.passed ? 'PASS' : verdict.provisional ? 'PROVISIONAL — NOT PROVEN' : 'FAIL';
  const source = data.decisive_experiment?.acceptance_source === 'REPLAY_VERIFIED_CLEANROOM_CERTIFICATE'
    ? 'REPLAY-VERIFIED CLEAN-ROOM CERTIFICATE'
    : 'CURRENT DETERMINISTIC OBSERVATORY';
  $('verdict').innerHTML = `<p class="tag">CURRENT EPISTEMIC VERDICT · ${esc(verdict.protocol_id)} · BLIND ${verdict.blind ? 'YES' : 'NO'}</p><h2>${label}</h2><p>Score ${pct(verdict.score)}% · novelty ${pct(verdict.novelty_score)}%</p><p><b>Evidence source</b> ${source}</p><p>${esc(verdict.reason)}</p><p class="muted">This verdict describes evidence quality, not permission for real-world action.</p>`;
  $('criteria').innerHTML = `<p class="tag">WHAT MUST BE TRUE</p>${Object.entries(verdict.criteria || {}).map(([key,value]) => `<p class="${value?'pass':'blocked'}">${value?'PASS':'PENDING'} · ${esc(key.replaceAll('_',' '))}</p>`).join('')}`;
  $('metrics').innerHTML = `<p class="tag">WHAT THE TRIAL SAW</p>${Object.entries(verdict.metrics || {}).map(([key,value]) => `<p>${esc(key.replaceAll('_',' '))}: <b>${esc(value)}</b></p>`).join('')}<p>Generation mode: <b>${esc(data.generation_mode)}</b></p>`;
}

function render(data) {
  if (!data.result || !data.cognition || !Array.isArray(data.generations)) throw new Error('Incomplete living response');
  renderDecisiveExperiment(data);
  const summary=data.experiment_summary||{};
  $('state').textContent=`${data.version} · ${data.generation_mode} · ${data.generations.length} GENERATIONS · ${data.cognition.readiness} · REAL-WORLD AUTHORITY BLOCKED`;
  $('summary').textContent=`${summary.total||0} experiments · ${list(summary.extinctions).length} extinctions · ${summary.fossils||0} fossils · ${list(summary.surprise_branches).length} surprise branches · ${list(summary.rebirths).length} controlled rebirths`;
  $('generations').innerHTML=data.generations.map(g=>`<section class="section gen"><h2>Generation ${g.generation}</h2><p class="tag">PARETO ${list(g.frontier).map(esc).join(' · ')||'NONE'} · FOSSILS ${g.fossil_count||0} · EXTINCT ${list(g.extinct).map(esc).join(' · ')||'NONE'} · SURPRISE ${list(g.surprises).map(esc).join(' · ')||'NONE'} · REBORN ${list(g.reborn).map(esc).join(' · ')||'NONE'}</p><div class="grid">${list(g.population).map(h=>`<article class="card lineage ${String(h.id).includes('SURPRISE')?'surprise':''} ${h.state==='REBORN'?'reborn':''} ${h.state==='DEAD'?'dead':''}"><p class="tag">${esc(h.state)} · ${esc(h.niche||'UNNICHED')} · ${esc(h.epistemic_class)}</p><h3>${esc(h.id)}</h3><p>${esc(h.statement)}</p><div class="meter"><i style="width:${pct(h.confidence)}%"></i></div><p><b>Confidence</b> ${pct(h.confidence)}%</p><p><b>Why it exists</b> ${list(h.ancestry?.parent_ids).map(esc).join(' + ')||'original candidate'} · ${list(h.ancestry?.operators).map(esc).join(' + ')||'no operator'}</p><p><b>Prediction</b> ${esc(list(h.predictions)[0]||'none declared')}</p><p><b>What could falsify it</b> ${esc(list(h.falsifiers)[0]||'none declared')}</p><p><b>Hard kill</b> ${esc(list(h.hard_kill_conditions)[0]||'none declared')}</p>${h.discriminating_test?`<p><b>Best next test</b> ${esc(h.discriminating_test)}</p>`:''}</article>`).join('')}</div><h3>Selection pressure</h3>${list(g.experiments).map(e=>`<p class="outcome ${e.state==='DEAD'?'extinct':''}">${esc(e.candidate_id)} → ${esc(e.outcome?.polarity||'UNKNOWN')} · ${pct(e.confidence)}%${e.fossil_risk?` · fossil risk ${pct(e.fossil_risk)}% from ${list(e.fossil_matches).map(esc).join(', ')}`:''}</p>`).join('')||'<p class="muted">No experiment records.</p>'}</section>`).join('');
  const c=data.cognition;
  $('meta').innerHTML=`<p class="tag">WHAT PORTAL IS UNCERTAIN ABOUT</p><p>Uncertainty <b>${pct(c.metacognition?.uncertainty)}%</b></p><p>${esc(c.metacognition?.question||'No question generated.')}</p><p class="tag">REAL-WORLD ACTION ${c.metacognition?.should_act?'ALLOWED':'BLOCKED'}</p>`;
  const trace=c.tool_trace||{budget:{spent:0,limit:0},events:[]};
  $('tools').innerHTML=`<p class="tag">WHAT IT ACTUALLY CONSULTED · BUDGET ${Number(trace.budget.spent||0).toFixed(2)} / ${Number(trace.budget.limit||0).toFixed(2)}</p>${list(trace.events).map(e=>`<p><b>${esc(e.tool_id)}</b> · ${esc(e.status)} · COST ${esc(e.cost)}<br><span class="trace">${esc(e.output?.provenance||'NO OUTPUT PROVENANCE')}</span></p>`).join('')||'<p>No tool executed.</p>'}`;
  $('critics').innerHTML=`<p class="tag">STRONGEST ATTACKS ON CURRENT THINKING</p>${list(c.critics).slice(0,6).map(x=>`<p>${esc(list(x.attacks)[0]||x.objective||x.id)}</p>`).join('')||'<p>No critic active.</p>'}`;
  $('communication').innerHTML=`<p class="tag">WHAT CAN BE SAID DEFENSIBLY</p><h3>${esc(c.communication?.headline||'No defensible explanation survived.')}</h3><p>${pct(c.communication?.confidence)}% confidence · ${pct(c.communication?.uncertainty)}% uncertainty · ${esc(c.communication?.epistemic_class||'CONSTRUCTED')}</p><p><b>Falsifier</b> ${esc(c.communication?.falsifier||'none declared')}</p><p><b>Most informative next observation</b> ${esc(c.communication?.next_observation||'none declared')}</p><p class="muted">${esc(c.communication?.caveat||'')}</p>`;
  $('plan').innerHTML=`<p class="tag">HOW IT WOULD REASON NEXT</p>${list(c.plan).map(i=>`<p><b>${esc(i.step)} · ${esc(i.status)}</b><br>${esc(i.detail)}</p>`).join('')||'<p>No plan trace.</p>'}<p class="tag">DECISIVE GATE · ${esc(c.decisive_gate||'UNKNOWN')}</p>`;
  $('timeline').innerHTML=list(data.result.timeline).map(i=>`<li><b>${esc(i.label)}</b> — ${list(i.population).map(h=>`${esc(h.id)} ${pct(h.confidence)}% ${esc(h.state)}`).join(' · ')}</li>`).join('')||'<li>No deterministic evidence events.</li>';
  $('fossils').innerHTML=list(data.result.fossil_record).map(f=>`<article class="card fossil"><p class="tag">${esc(f.id)} · DEAD</p><h3>${esc(f.statement)}</h3><p>Final confidence ${pct(f.final_confidence)}%</p><p><b>Superseded by</b> ${esc(f.superseded_by||'none')}</p><p><b>Why it can die again</b> ${esc(list(f.falsifiers)[0]||'none')}</p><p class="trace">Evidence: ${list(f.evidence).map(e=>esc(e.id)).join(' → ')||'none'}</p></article>`).join('')||'<p>No deterministic fossils yet.</p>';
  $('acceptance').innerHTML=Object.entries({...data.result.acceptance,...c.acceptance}).map(([k,v])=>`<p class="${v?'pass':'blocked'}">${v?'PASS':'PENDING'} · ${esc(k.replaceAll('_',' '))}</p>`).join('');
  $('safety').innerHTML=Object.entries(data.safety||{}).map(([k,v])=>`<p class="${v?'':'blocked'}">${v?'ALLOWED':'BLOCKED'} · ${esc(k.replaceAll('_',' '))}</p>`).join('')||'<p class="blocked">Safety envelope unavailable.</p>';
}

function renderEvidenceResult(data, summary){
  const d=data.decision||{}; const routes=list(d.routes); const scope=list(d.scope); const wake=Boolean(d.wake);
  const affected=routes.length?routes.map(r=>`<li><b>${esc(r.id)}</b> · relevance ${pct(r.relevance)}%</li>`).join(''):scope.map(id=>`<li><b>${esc(id)}</b> · exploratory scope</li>`).join('');
  const nearest=d.change?.nearest;
  $('evidenceResult').innerHTML=`<p class="decision">${wake?'WAKE':'STORE'} · EVIDENCE EVALUATED</p><h3>${wake?'This observation would wake the organism.':'This observation would not materially change the organism.'}</h3><p><b>Your observation</b><br>${esc(summary)}</p><p><b>Novelty</b> ${pct(d.change?.novelty)}% · ${d.change?.meaningful?'meaningful change detected':'similar to existing memory'}</p><p><b>Why</b> ${esc(d.reason||'No material change')}</p>${nearest?`<p><b>Nearest remembered evidence</b> ${esc(nearest.id)} · similarity ${pct(nearest.score)}%</p>`:''}<p><b>${routes.length?'Lineages directly intersected':'Lineages Portal would inspect first'}</b></p><ul>${affected||'<li>No lineage selected.</li>'}</ul><p class="containment"><b>BOUNDARY</b><br>COUNTERFACTUAL ONLY · NOT PERSISTED · ARCHIVE UNCHANGED · NO REAL-WORLD ACTION</p>`;
  $('evidenceResult').hidden=false;
  $('evidenceResult').focus({preventScroll:true});
  $('evidenceResult').scrollIntoView({behavior:'smooth',block:'nearest'});
}

async function load(){render(await request('/api/living'));}

$('sendObservation').addEventListener('click',async()=>{
  const summary=$('observation').value.trim();
  if(!summary){$('intake').textContent='ENTER AN OBSERVATION FIRST · nothing was evaluated.';$('observation').focus();return;}
  const button=$('sendObservation'); button.disabled=true; button.classList.add('busy'); button.textContent='EVALUATING…';
  $('intake').textContent='CHALLENGING CURRENT LINEAGES…'; $('evidenceResult').hidden=true;
  try{
    const data=await request('/api/living',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({summary,source:'PRODUCTION_NON_PERSISTENT_PROBE'})});
    renderEvidenceResult(data,summary);
    $('intake').textContent=`COMPLETE · ${data.decision?.wake?'WAKE':'STORE'} · novelty ${pct(data.decision?.change?.novelty)}%`;
  }catch(error){$('intake').textContent=`EVIDENCE ERROR · ${error.message}`;$('evidenceResult').hidden=false;$('evidenceResult').innerHTML=`<p class="decision">EVALUATION FAILED</p><p>${esc(error.message)}</p><p>No state was changed.</p>`;}
  finally{button.disabled=false;button.classList.remove('busy');button.textContent='EVALUATE EVIDENCE';}
});
$('observation').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();$('sendObservation').click();}});
load().catch(error=>{$('state').textContent=`LIVING OBSERVATORY UNAVAILABLE · ${error.message}`;$('verdict').textContent='DECISIVE EXPERIMENT UNAVAILABLE';});
