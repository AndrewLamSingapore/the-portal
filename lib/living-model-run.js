/**
 * Living model run — paid, model-originated discovery cycle under the living
 * model budget. It reserves spend before any provider call, persists the run as
 * a MODEL_CYCLE job, and settles the reservation (releasing it on failure).
 * Inactive unless PORTAL_LIVING_MODEL_ENABLED=1.
 */

import { db } from './db.js';
import { SANDBOX_SEED, runLivingSandbox } from './living-sandbox.js';
import { generateHypothesisPopulation } from './hypothesis-generation.js';
import { isModelBudgetEnabled, admitModelRequest, settleModelReservation } from './living-budget.js';
import { ensureEngineSchema, enqueueJob, claimNextJob, checkpointJob, completeJob, appendAudit, latestCompletedRun } from './living-engine.js';
import { listPendingEvidence, markEvidenceConsumed, applyEvidenceToPopulation } from './living-evidence.js';

const MODEL_CYCLE_KIND = 'MODEL_CYCLE';

export function mapPopulation(candidates = []) {
  return candidates.map(candidate => ({
    id: candidate.id,
    statement: candidate.statement,
    epistemic_class: candidate.epistemic_class,
    state: candidate.state || 'EMERGING',
    confidence: candidate.confidence,
    predictions: candidate.predictions || [],
    falsifiers: candidate.falsifiers || [],
    hard_kill_conditions: candidate.hard_kill_conditions || [],
    ancestry: candidate.ancestry || null
  }));
}

export function nextGenerationNumber(latest) {
  return Math.max(1, (Number(latest?.result?.generation_number) || 0) + 1);
}

export function buildPriorMemory(population = []) {
  return population.map(item => ({
    id: item.id,
    layer: 'EPISTEMIC',
    content: { hypothesis: item.id, statement: item.statement, state: item.state || 'EMERGING' },
    strength: 0.5
  }));
}

export function computeFossils({ priorPopulation = [], priorFossils = [], contradictions = [] } = {}) {
  // Omission from a new generation is not falsification. A hypothesis becomes a
  // fossil only when it is explicitly contradicted by evidence; otherwise it
  // remains dormant and stays in intellectual memory for reconsideration.
  const contradicted = new Set((contradictions || []).map(item => item.hypothesis_id));
  const rejected = priorPopulation.filter(item => contradicted.has(item.id));
  const fossils = [
    ...(Array.isArray(priorFossils) ? priorFossils : []),
    ...rejected.map(item => ({
      id: item.id,
      statement: item.statement,
      final_confidence: item.confidence,
      superseded_by: null,
      ancestry: item.ancestry || null,
      rejection_reason: 'contradicted_by_evidence'
    }))
  ];
  return {
    fossils,
    rejected,
    dormant: priorPopulation.length - rejected.length,
    self_correction: rejected.length > 0 || (Array.isArray(priorFossils) && priorFossils.length > 0)
  };
}

export async function runModelCycleOnce({ sql = db(), owner = 'scheduler', idempotencyKey = null, generate = generateHypothesisPopulation } = {}) {
  if (!isModelBudgetEnabled()) return { status: 'DISABLED', reason: 'PORTAL_LIVING_MODEL_ENABLED is not 1' };
  if (!process.env.OPENAI_API_KEY) return { status: 'BLOCKED', reason: 'OPENAI_API_KEY not configured' };
  if (!sql) return { status: 'BLOCKED', reason: 'DATABASE_URL is required for durable model runs' };
  await ensureEngineSchema(sql);

  const reservation = Math.max(0, Number(process.env.PORTAL_LIVING_MODEL_RUN_RESERVATION_MICRO_USD || 100_000));
  const windowKey = idempotencyKey || `${MODEL_CYCLE_KIND}:${new Date().toISOString().slice(0, 13)}`;
  const job = await enqueueJob(sql, { kind: MODEL_CYCLE_KIND, idempotencyKey: windowKey, payload: { owner } });
  if (!job) return { status: 'SKIPPED', reason: 'A model run is already recorded for this window' };

  const claimed = await claimNextJob(sql, { owner, kind: MODEL_CYCLE_KIND });
  if (!claimed) return { status: 'SKIPPED', reason: 'No claimable job available' };
  await appendAudit(sql, { event: 'model_job.claimed', jobId: claimed.id, detail: { owner } });

  const admission = await admitModelRequest(sql, { requestId: claimed.id, estimatedMicroUsd: reservation });
  if (!admission.allowed) {
    await completeJob(sql, claimed.id, { status: 'FAILED', error: admission.reason, result: { generation_mode: 'MODEL_ORIGINATED', model_calls: 0, rejected: true } });
    await appendAudit(sql, { event: 'model_job.rejected', jobId: claimed.id, detail: { reason: admission.reason } });
    return { status: 'REJECTED', reason: admission.reason, budget: admission };
  }

  try {
    await checkpointJob(sql, claimed.id, { phase: 'model_started', owner, reservation_micro_usd: reservation });
    const latest = await latestCompletedRun(sql);
    const priorPopulation = Array.isArray(latest?.result?.population) ? latest.result.population : [];
    const priorFossils = Array.isArray(latest?.result?.fossils) ? latest.result.fossils : [];
    const generation = nextGenerationNumber(latest);
    const seed = runLivingSandbox(SANDBOX_SEED);
    const evidence = await listPendingEvidence(sql);
    const evidenceObservations = evidence.map(item => ({ id: item.id, summary: item.summary }));
    const generated = await generate({
      observations: [...seed.observations, ...evidenceObservations],
      memory: buildPriorMemory(priorPopulation),
      generation
    });
    if (!generated?.candidates?.length) throw new Error('Model returned no candidates');
    await settleModelReservation(sql, { requestId: claimed.id, microUsd: reservation, success: true, usage: generated.usage });

    const priorContradictions = evidence
      .filter(item => item.relation === 'contradicts' && priorPopulation.some(hypothesis => hypothesis.id === item.target_id))
      .map(item => ({ hypothesis_id: item.target_id, evidence_id: item.id, summary: item.summary }));
    const lineage = computeFossils({ priorPopulation, priorFossils, contradictions: priorContradictions });
    const applied = applyEvidenceToPopulation({ population: mapPopulation(generated.candidates), fossils: lineage.fossils, evidence });
    const fossils = lineage.fossils.filter(fossil => !applied.rebirths.some(rebirth => rebirth.id === fossil.id));
    await markEvidenceConsumed(sql, evidence.map(item => item.id));
    const result = {
      generated_at: new Date().toISOString(),
      generation_mode: 'MODEL_ORIGINATED',
      deterministic: false,
      model_calls: 1,
      model: generated.model,
      usage: generated.usage || null,
      population: applied.population,
      fossils,
      generation_number: generation,
      prior_lineage: priorPopulation.map(item => item.id),
      revisions: lineage.rejected.length,
      dormant_count: lineage.dormant,
      self_correction: lineage.self_correction,
      evolutionary_improvement: generation > 1 && lineage.fossils.some(fossil => fossil.rejection_reason),
      contradictions: [...priorContradictions, ...applied.contradictions],
      rebirths: applied.rebirths,
      synthesis: generated.synthesis,
      next_question: generated.next_question,
      expenditure_micro_usd: reservation,
      safety: {
        actuation_allowed: false,
        production_source_mutation_allowed: false,
        production_database_writes_allowed: false,
        deployment_mutation_allowed: false
      }
    };
    await completeJob(sql, claimed.id, { status: 'COMPLETED', result });
    await appendAudit(sql, { event: 'model_job.completed', jobId: claimed.id, detail: { model: generated.model, expenditure_micro_usd: reservation } });
    return { status: 'COMPLETED', job: claimed.id, request_id: claimed.id, result };
  } catch (error) {
    const message = String(error?.message || error);
    // A failure after the provider call may still be billable. Never release the
    // reservation here; the ledger records it conservatively as FAILED.
    await settleModelReservation(sql, { requestId: claimed.id, microUsd: reservation, success: false, release: false });
    await completeJob(sql, claimed.id, { status: 'FAILED', error: message, result: { generation_mode: 'MODEL_ORIGINATED', model_calls: 0 } });
    await appendAudit(sql, { event: 'model_job.failed', jobId: claimed.id, detail: { error: message } });
    return { status: 'FAILED', job: claimed.id, error: message };
  }
}
