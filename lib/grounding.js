const TOKEN_RE = /[a-z0-9][a-z0-9_-]{2,}/g;

function tokens(value) {
  return new Set(String(value || '').toLowerCase().match(TOKEN_RE) || []);
}

export function filterKnowledgeGraph(graph, query, limit = 12) {
  const q = tokens(query);
  if (!q.size || !graph || !Array.isArray(graph.nodes)) return graph;
  const capped = Math.max(1, Math.min(Number(limit) || 12, 50));
  const ranked = graph.nodes.map((node) => {
    const text = ['label','title','name','summary','description','type']
      .map((key) => node?.[key] ?? '')
      .join(' ');
    const n = tokens(text);
    let score = 0;
    for (const token of q) if (n.has(token)) score += 1;
    return { node, score };
  }).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, capped);
  const ids = new Set(ranked.map(({ node }) => String(node.id ?? node.key ?? node.name ?? '')));
  const edges = Array.isArray(graph.edges)
    ? graph.edges.filter((edge) => ids.has(String(edge.source)) && ids.has(String(edge.target)))
    : [];
  return {
    ...graph,
    nodes: ranked.map(({ node, score }) => ({ ...node, grounding_score: score })),
    edges,
    grounding: { query: String(query), matched_nodes: ranked.length, limit: capped }
  };
}
