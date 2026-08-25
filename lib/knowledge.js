const text = value => String(value || '').trim();

export function buildKnowledgeGraph(items = []) {
  const nodes = items.map(a => ({ id: a.id, year: a.year, title: a.title, evidence_level: a.evidence_level || 'AI-CURATED', concepts: a.concepts || [] })).sort((a, b) => a.year - b.year);
  const ids = new Set(nodes.map(node => node.id));
  const edges = [];
  for (let i = 0; i < nodes.length; i += 1) for (let j = i + 1; j < nodes.length; j += 1) {
    const concepts = nodes[i].concepts.filter(concept => nodes[j].concepts.includes(concept));
    if (concepts.length) edges.push({ from: nodes[i].id, to: nodes[j].id, type: 'CONCEPTUAL_ECHO', concepts, strength: Math.min(1, .35 + concepts.length * .2) });
  }
  for (const artifact of items) for (const connection of artifact.connections || []) {
    if (ids.has(connection.target_id) && connection.target_id !== artifact.id) edges.push({
      from: artifact.id, to: connection.target_id, type: connection.type, concepts: connection.concept ? [connection.concept] : [],
      reason: text(connection.reason), strength: Number(connection.confidence) || .5
    });
  }
  return { nodes, edges: edges.slice(0, 120) };
}

export function buildEvolution(items = []) {
  const seen = new Map();
  const events = [...items].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)).map(artifact => {
    const newConcepts = [], strengthenedConcepts = [];
    for (const concept of artifact.concepts || []) {
      if (seen.has(concept)) strengthenedConcepts.push(concept); else newConcepts.push(concept);
      seen.set(concept, (seen.get(concept) || 0) + 1);
    }
    return { id: artifact.id, title: artifact.title, created_at: artifact.created_at, new_concepts: newConcepts, strengthened_concepts: strengthenedConcepts, connections_created: (artifact.connections || []).length, experiment: artifact.experiment || null };
  });
  return {
    events: events.reverse().slice(0, 20),
    emerging_concepts: [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
    open_experiments: [...items].filter(a => a.experiment?.hypothesis).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 8).map(a => ({ id: a.id, title: a.title, experiment: a.experiment }))
  };
}
