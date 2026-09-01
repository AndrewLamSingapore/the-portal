const TOKEN_RE = /[a-z0-9][a-z0-9_-]{2,}/g;

export const ENTITY_TYPES = new Set(['person','project','objective','decision','experiment','evidence','claim','source','observation','hypothesis','asset','repository','capability','failure','lesson']);
export const EDGE_TYPES = new Set(['supports','contradicts','depends_on','derived_from','tested_by','owned_by','supersedes','failed_because','related_to','generated','validated_by']);

const tokens = (value='') => new Set(String(value).toLowerCase().match(TOKEN_RE) || []);
const jaccard = (a,b) => { const u=new Set([...a,...b]); if(!u.size) return 0; let i=0; for(const x of a) if(b.has(x)) i++; return i/u.size; };

export function normalizeNode(node) {
  if (!node?.id) throw new Error('semantic node requires id');
  const type=String(node.type||'').toLowerCase();
  if(!ENTITY_TYPES.has(type)) throw new Error(`unsupported semantic node type: ${type}`);
  return {...node,type,provenance:Array.isArray(node.provenance)?node.provenance:[],evidence_level:node.evidence_level||'E0'};
}

export function normalizeEdge(edge) {
  if(!edge?.source || !edge?.target) throw new Error('semantic edge requires source and target');
  const type=String(edge.type||'').toLowerCase();
  if(!EDGE_TYPES.has(type)) throw new Error(`unsupported semantic edge type: ${type}`);
  return {...edge,type,provenance:Array.isArray(edge.provenance)?edge.provenance:[],evidence_level:edge.evidence_level||'E0'};
}

export function hybridSearch(query,nodes,{limit=12,semanticScorer}={}) {
  const q=tokens(query); const ranked=[];
  for(const raw of nodes||[]) {
    const node=normalizeNode(raw);
    const text=[node.label,node.title,node.name,node.summary,node.description,node.type].filter(Boolean).join(' ');
    const lexical=jaccard(q,tokens(text));
    const semantic=typeof semanticScorer==='function' ? Number(semanticScorer(query,node)||0) : 0;
    const provenance=Math.min(node.provenance.length/3,1);
    const score=(lexical*.55)+(semantic*.35)+(provenance*.10);
    if(score>0) ranked.push({node,score,lexical,semantic,provenance});
  }
  return ranked.sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(limit,50)));
}

export function contradictions(nodes,edges) {
  const byId=new Map((nodes||[]).map(n=>[n.id,normalizeNode(n)]));
  return (edges||[]).map(normalizeEdge).filter(e=>e.type==='contradicts').map(edge=>({edge,source:byId.get(edge.source)||null,target:byId.get(edge.target)||null}));
}
