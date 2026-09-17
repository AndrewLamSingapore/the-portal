(function () {
  'use strict';

  function canonicalJson(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function attachDigest(payload) {
    return {
      ...payload,
      digest: {
        algorithm: 'SHA-256',
        encoding: 'portal-canonical-json-v1',
        value: await sha256(canonicalJson(payload))
      }
    };
  }

  async function buildArtifactSnapshot(artifact, exportedAt = new Date().toISOString()) {
    if (!artifact || typeof artifact !== 'object' || !String(artifact.id || '').trim()) throw new TypeError('A valid artifact is required.');
    return attachDigest({
      schema_version: 'portal-artifact-snapshot-v1',
      artifact_id: String(artifact.id),
      exported_at_utc: exportedAt,
      export_mode: 'LOCAL_USER_INITIATED',
      qualification_status: String(artifact.evidence_level || 'UNQUALIFIED'),
      uncertainty_labels: [...new Set([artifact.evidence_level, artifact.status, ...(artifact.lifecycle || []).map(event => event.evidence_basis)].filter(Boolean).map(String))],
      provenance: artifact.provenance || null,
      notice: 'This snapshot preserves the exact displayed artifact. Its digest detects byte-level semantic changes; it does not promote a claim or prove historical truth.',
      artifact: JSON.parse(JSON.stringify(artifact))
    });
  }

  async function verifyDocumentDigest(document) {
    if (!document || typeof document !== 'object' || Array.isArray(document)) return { valid: false, reason: 'Document must be a JSON object.' };
    const expected = document.digest && document.digest.value;
    if (!/^[a-f0-9]{64}$/.test(String(expected || ''))) return { valid: false, reason: 'A valid SHA-256 digest is missing.' };
    const payload = Object.fromEntries(Object.entries(document).filter(([key]) => key !== 'digest'));
    const calculated = await sha256(canonicalJson(payload));
    return { valid: calculated === expected, expected, calculated };
  }

  function downloadJson(document, filename) {
    const blob = new Blob([`${JSON.stringify(document, null, 2)}\n`], { type: 'application/json' });
    const link = documentElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function documentElement(tag) { return window.document.createElement(tag); }

  window.PortalEvidenceExport = { canonicalJson, sha256, buildArtifactSnapshot, verifyDocumentDigest, downloadJson };
}());
