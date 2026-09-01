const TOKEN = /[a-z0-9][a-z0-9_-]{2,}/g;
const words = (value='') => new Set(String(value).toLowerCase().match(TOKEN) || []);
const jaccard = (a,b) => { const A=words(a), B=words(b); if(!A.size||!B.size)return 0; let n=0; for(const x of A) if(B.has(x)) n++; return n/(A.size+B.size-n); };

export const ENTITY_TYPES = new Set(['person','project','objective','decision','experiment','evidence','claim','source','observation','hypothesis','asset','repository','capability','failure','lesson']);
export const EDGE_TYPES = new Set(['supports','contradicts','depends_on','derived_from','tested_by','owned_by','supersedes','failed_because','related_to','generated','validated_by']);

export function normalizeNode(node){
  if(!node?.id) throw new Error('node.id required');
  const type=String(node.type||'claim').toLowerCase();
  if(!ENTITY_TYPES.has(type)) throw new Error(`unsupported node type: ${type}`);
  return {...node,type,provenance:Array.isArray(node.provenance)?node.provenance:[],evidence_level:node.evidence_level||'E0'};
}
export function normalizeEdge(edge){
  if(!edge?.source||!edge?.target) throw new Error('edge source/target required');
  const type=String(edge.type||'related_to').toLowerCase();
  if(!EDGE_TYPES.has(type)) throw new Error(`unsupported edge type: ${type}`);
  return {...edge,type};
}
export function semanticSearch(query,nodes,limit=12){
  return nodes.map(normalizeNode).map(node=>{const text=[node.title,node.label,node.name,node.summary,node.description,node.type].filter(Boolean).join(' '); const lexical=jaccard(query,text); const grounding=Number(node.grounding_score||0)/100; const provenance=Math.min(1,node.provenance.length/3); return {...node,semantic_score:(lexical*.65)+(grounding*.25)+(provenance*.10)};}).filter(x=>x.semantic_score>0).sort((a,b)=>b.semantic_score-a.semantic_score).slice(0,Math.max(1,Math.min(limit,50)));
}
export function contradictions(nodes,edges){
  const map=new Map(nodes.map(n=>[String(n.id),normalizeNode(n)]));
  return edges.map(normalizeEdge).filter(e=>e.type==='contradicts').map(e=>({edge:e,source:map.get(String(e.source))||null,target:map.get(String(e.target))||null}));
}
export function buildWorldModel({nodes=[],edges=[]}={}){return {nodes:nodes.map(normalizeNode),edges:edges.map(normalizeEdge),contradictions:contradictions(nodes,edges)};}
