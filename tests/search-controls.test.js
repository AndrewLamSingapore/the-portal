import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSearch, searchAdmission } from '../lib/search-controls.js';
import { openAiEmbed, semanticScores } from '../lib/semantic-embeddings.js';
test('search input bounds reject ambiguous and expensive queries',()=>{
  for(const q of [['x'],{},'x'.repeat(257),'😀'.repeat(257)])assert.ok(validateSearch({q}).error);
  for(const limit of ['0','25','2.5','1e1',['1']])assert.ok(validateSearch({limit}).error);
  assert.deepEqual(validateSearch({q:'  privacy  ',limit:'24'}),{query:'privacy'});
});
test('shared admission denies exhausted budgets and storage failure',async()=>{
  const counts=new Map();
  const sql=async(strings,...values)=>{if(strings.join('').includes('returning hits')){const key=values[0];counts.set(key,(counts.get(key)||0)+1);return [{hits:counts.get(key)}];}return [];};
  for(let i=0;i<20;i++)assert.equal((await searchAdmission({socket:{remoteAddress:'fixture'}},{sql})).allowed,true);
  assert.equal((await searchAdmission({socket:{remoteAddress:'fixture'}},{sql})).status,429);
  assert.equal((await searchAdmission({}, {sql:async()=>{throw Error('offline')}})).status,503);
  assert.equal((await searchAdmission({}, {sql:null})).status,503);
});
test('embedding transport has an abort deadline and rejects incomplete vectors',async()=>{
  const previous=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='fixture';
  try{await assert.rejects(openAiEmbed(['x'],{fetchImpl:async(_url,options)=>{assert.ok(options.signal instanceof AbortSignal);return {ok:true,json:async()=>({data:[]})};}}),/incomplete/);}finally{if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;}
});
test('warm query and node cache avoid paid embedding calls',async()=>{
  const {createHash}=await import('node:crypto');
  const contentHash=createHash('sha256').update('Privacy asset').digest('hex');
  const sql=async(strings)=>{const q=strings.join('');if(q.includes('select entity_id'))return [{entity_id:'a',content_hash:contentHash,vector_json:[1,0]}];if(q.includes('select vector_json'))return [{vector_json:[1,0]}];return [];};
  const result=await semanticScores('privacy',[{id:'a',label:'Privacy',type:'asset'}],{sql,embedder:async()=>{throw Error('must not call provider')}});
  assert.equal(result.status.degraded,false);assert.equal(result.scores.get('a'),1);
});
test('provider timeout degrades to lexical response without exposing credentials',async()=>{
  const result=await semanticScores('privacy',[],{sql:async()=>[],embedder:async()=>{throw new DOMException('deadline','TimeoutError')}});
  assert.equal(result.status.mode,'lexical_fallback');assert.equal(result.scores.size,0);
});
