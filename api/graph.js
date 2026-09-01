import { findArtifacts, hasDatabase, listExperimentResults } from '../lib/db.js';
import { attachExperimentResults } from '../lib/experiment-result.js';
import { buildKnowledgeGraph } from '../lib/knowledge.js';
import { expandGraphNeighborhood, hybridSearch } from '../src/lib/semantic-world-model.js';
import { semanticScores } from '../lib/semantic-embeddings.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!hasDatabase()) return res.status(503).json({ error: 'Archive unavailable' });
  const [artifacts, results] = await Promise.all([
    findArtifacts({ limit: 60 }),
    listExperimentResults(60)
  ]);
  const graph = attachExperimentResults(buildKnowledgeGraph(artifacts), results);
  const query = String(req.query?.q || '').trim();
  if (!query) return res.status(200).json(graph);
  const nodes=graph.nodes.map(node=>({...node,type:'asset',provenance:Array.isArray(node.sources)?node.sources:[]}));
  const semantic=await semanticScores(query,nodes);const ranked=hybridSearch(query,nodes,{limit:req.query?.limit,semanticScorer:(_query,node)=>semantic.scores.get(node.id)||0});const expanded=expandGraphNeighborhood(ranked,graph,{limit:24});const ids=new Set(expanded.map(item=>item.node.id));const rank=new Map(ranked.map(item=>[item.node.id,item]));
  return res.status(200).json({...graph,nodes:expanded.map(item=>{const scored=rank.get(item.node.id);return {...item.node,grounding_score:scored?Math.round(scored.score*100):0,semantic_score:scored?.semantic||0,lexical_score:scored?.lexical||0,graph_neighbor:!item.match}}),edges:graph.edges.filter(edge=>ids.has(edge.from)&&ids.has(edge.to)),grounding:{query,matched_nodes:ranked.length,expanded_nodes:expanded.length,...semantic.status}});
}
