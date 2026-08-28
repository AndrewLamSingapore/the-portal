import { findArtifacts, hasDatabase, listExperimentResults } from '../lib/db.js';
import { attachExperimentResults } from '../lib/experiment-result.js';
import { buildKnowledgeGraph } from '../lib/knowledge.js';

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
  return res.status(200).json(attachExperimentResults(buildKnowledgeGraph(artifacts), results));
}
