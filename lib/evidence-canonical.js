import crypto from 'node:crypto';

export const CANONICAL_ENCODING = 'portal-canonical-json-v1';
export const DIGEST_ALGORITHM = 'SHA-256';

export function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON rejects non-finite numbers');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  throw new TypeError('Canonical JSON accepts only JSON values');
}

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function canonicalDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

export function calldataDigest(calldata) {
  const normalized = String(calldata || '').toLowerCase();
  if (!/^0x(?:[0-9a-f]{2})*$/.test(normalized)) throw new TypeError('Invalid calldata');
  return sha256Hex(Buffer.from(normalized.slice(2), 'hex'));
}

export function attachDigest(payload) {
  return {
    ...payload,
    digest: {
      algorithm: DIGEST_ALGORITHM,
      canonical_encoding: CANONICAL_ENCODING,
      value: canonicalDigest(payload),
    },
  };
}

