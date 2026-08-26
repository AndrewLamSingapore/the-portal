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

const PHASES = ['EMERGED', 'DISAPPEARED', 'RETURNED', 'FAILED', 'PARTIALLY_REALIZED', 'REALIZED'];

export function buildContinuousModel(items = []) {
  const transitions = [];
  const phaseCounts = Object.fromEntries(PHASES.map(phase => [phase, 0]));
  const recurrenceConditions = new Map();

  for (const artifact of items) {
    const lifecycle = Array.isArray(artifact.lifecycle) ? [...artifact.lifecycle].sort((a, b) => a.year - b.year) : [];
    lifecycle.forEach((event, index) => {
      if (!PHASES.includes(event.phase)) return;
      phaseCounts[event.phase] += 1;
      transitions.push({
        artifact_id: artifact.id,
        title: artifact.title,
        from: index ? lifecycle[index - 1].phase : null,
        to: event.phase,
        year: event.year,
        description: text(event.description),
        evidence_basis: event.evidence_basis || 'AI-GENERATED-HYPOTHESIS'
      });
    });
    for (const condition of artifact.recurrence_conditions || []) {
      const normalized = text(condition);
      if (normalized) recurrenceConditions.set(normalized, (recurrenceConditions.get(normalized) || 0) + 1);
    }
  }

  return {
    model_version: 1,
    generated_at: new Date().toISOString(),
    phases: phaseCounts,
    transitions: transitions.sort((a, b) => b.year - a.year).slice(0, 60),
    recurrence_conditions: [...recurrenceConditions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([condition, count]) => ({ condition, count })),
    realization_watchlist: items.filter(item => item.realization_signal && item.current_phase !== 'REALIZED').map(item => ({ id: item.id, title: item.title, current_phase: item.current_phase, signal: item.realization_signal })).slice(0, 12),
    evidence_boundary: 'Lifecycle events remain hypotheses unless their evidence_basis is SOURCE-SUPPORTED.'
  };
}
