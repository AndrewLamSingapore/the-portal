const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));

export const FITNESS_KEYS = ['accuracy', 'evidence', 'novelty', 'utility', 'robustness', 'efficiency', 'calibration', 'constraint_compliance'];

export function dominates(a, b) {
  const av = a?.fitness || {};
  const bv = b?.fitness || {};
  const noWorse = FITNESS_KEYS.every(key => clamp(av[key]) >= clamp(bv[key]));
  const better = FITNESS_KEYS.some(key => clamp(av[key]) > clamp(bv[key]));
  return noWorse && better;
}

export function paretoFrontier(population = []) {
  return population.filter(candidate => !population.some(other => other !== candidate && dominates(other, candidate)));
}

export function evidenceDelta(evidence = []) {
  return evidence.reduce((sum, item) => {
    const weight = item.basis === 'OBSERVATION' || item.basis === 'SOURCE' || item.basis === 'TOOL_RESULT' ? 0.12 : 0.06;
    if (item.polarity === 'SUPPORTS') return sum + weight;
    if (item.polarity === 'CONTRADICTS') return sum - weight * 1.25;
    return sum;
  }, 0);
}

export function updateConfidence(hypothesis, newEvidence = []) {
  return clamp(clamp(hypothesis?.confidence) + evidenceDelta(newEvidence));
}

const TRANSITIONS = {
  EMERGING: new Set(['LIVING', 'CONTESTED', 'DORMANT', 'DEAD']),
  LIVING: new Set(['CONTESTED', 'DORMANT', 'DEAD']),
  CONTESTED: new Set(['LIVING', 'DORMANT', 'DEAD']),
  DORMANT: new Set(['CONTESTED', 'DEAD', 'REBORN']),
  DEAD: new Set(['REBORN']),
  REBORN: new Set(['LIVING', 'CONTESTED', 'DORMANT', 'DEAD'])
};

export function canTransition(from, to) {
  return Boolean(TRANSITIONS[from]?.has(to));
}

export function nextState(hypothesis, newEvidence = []) {
  const confidence = updateConfidence(hypothesis, newEvidence);
  const contradictions = newEvidence.filter(item => item.polarity === 'CONTRADICTS').length;
  if (confidence <= 0.15 && contradictions) return { state: 'DEAD', confidence };
  if (contradictions && confidence < 0.5) return { state: 'CONTESTED', confidence };
  if (hypothesis.state === 'EMERGING' && confidence >= 0.5) return { state: 'LIVING', confidence };
  return { state: hypothesis.state, confidence };
}

export function validateEvolutionCandidate(candidate) {
  const errors = [];
  if (!candidate?.id) errors.push('id required');
  if (!candidate?.statement) errors.push('statement required');
  if (!Array.isArray(candidate?.falsifiers) || !candidate.falsifiers.length) errors.push('at least one falsifier required');
  if (!candidate?.ancestry || !Array.isArray(candidate.ancestry.operators) || !candidate.ancestry.operators.length) errors.push('ancestry operator required');
  if (!candidate?.epistemic_class) errors.push('epistemic class required');
  return { valid: errors.length === 0, errors };
}
