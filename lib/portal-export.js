import { attachDigest, canonicalDigest, canonicalJson } from './evidence-canonical.js';

export const EXPORT_SCHEMA = 'portal-artifact-snapshot-v1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function buildArtifactSnapshot(artifact, exportedAt = new Date().toISOString()) {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) throw new TypeError('An artifact object is required');
  if (!String(artifact.id || '').trim()) throw new TypeError('The artifact must have an id');
  return attachDigest({
    schema_version: EXPORT_SCHEMA,
    artifact_id: String(artifact.id),
    exported_at_utc: exportedAt,
    export_mode: 'LOCAL_USER_INITIATED',
    qualification_status: String(artifact.evidence_level || 'UNQUALIFIED'),
    uncertainty_labels: [...new Set([
      artifact.evidence_level,
      artifact.status,
      ...(artifact.lifecycle || []).map(event => event.evidence_basis)
    ].filter(Boolean).map(String))],
    provenance: artifact.provenance || null,
    notice: 'This snapshot preserves the exact displayed artifact. Its digest detects byte-level semantic changes; it does not promote a claim or prove historical truth.',
    artifact: clone(artifact)
  });
}

export function verifyDocumentDigest(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) return { valid: false, reason: 'Document must be a JSON object.' };
  const expected = document.digest?.value;
  if (!/^[a-f0-9]{64}$/.test(String(expected || ''))) return { valid: false, reason: 'A valid SHA-256 digest is missing.' };
  const payload = Object.fromEntries(Object.entries(document).filter(([key]) => key !== 'digest'));
  const calculated = canonicalDigest(payload);
  return { valid: calculated === expected, expected, calculated, canonical_json: canonicalJson(payload) };
}
