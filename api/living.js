import { runLivingSandbox, SANDBOX_SEED } from '../lib/living-sandbox.js';
import { LayeredMemory, runExecutiveCycle, TOOL_REGISTRY } from '../lib/living-intelligence.js';
import { generateHypothesisPopulation } from '../lib/hypothesis-generation.js';
import { runGenerations } from '../lib/multigeneration.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  const enabled = process.env.PORTAL_LIVING_SANDBOX === '1' || process.env.VERCEL_ENV === 'preview'; if (!enabled) return res.status(404).json({ error: 'Living sandbox disabled' });
  const result = runLivingSandbox(SANDBOX_SEED);
  const memory = new LayeredMemory([...result.observations.map(item => ({ id: item.id, layer: 'EPISODIC', content: item })), { id: 'MEM-FOSSIL-001', layer: 'EPISTEMIC', content: 'Single-signal degradation theories often failed when hydraulic restrictions were unmeasured.', strength: .72 }, { id: 'MEM-PROCEDURE-001', layer: 'PROCEDURAL', content: 'When causal alternatives compete, seek an intervention that changes one cause without changing the other.', strength: .8 }]);
  let generated = null, generation_error = null;
  try { generated = await generateHypothesisPopulation({ observations: result.observations, memory: memory.records, generation: 1 }); } catch (error) { generation_error = String(error?.message || 'generation failed').slice(0, 240); }
  const initialPopulation = generated?.candidates?.length ? generated.candidates : result.population.map((x,i) => ({ ...x, id:`HYP-G1-${String(i+1).padStart(2,'0')}`, generation:1 }));
  const generations = runGenerations(initialPopulation, 4);
  const finalPopulation = generations.at(-1)?.population || initialPopulation;
  for (const h of finalPopulation) memory.remember({ id:`MEM-LINEAGE-${h.id}`, layer:'EPISTEMIC', content:{ hypothesis:h.id, ancestry:h.ancestry, fitness:h.fitness } });
  const cognition = runExecutiveCycle({ goal: 'Challenge the surviving multi-generation possibilities and choose the next discriminating observation.', population: finalPopulation, memory });
  return res.status(200).json({ product:'The Portal', version:'6.3.0-preview.5', mode:'SANDBOX', production_mutation:false, generation_mode:generated?'MODEL_ORIGINATED':'DETERMINISTIC_FALLBACK', generation_error, tool_registry:TOOL_REGISTRY, result, generated, generations, cognition });
}
