import crypto from 'node:crypto';
import { EvidenceInputError, verifyTransaction } from './ethereum-evidence.js';

const DEFAULT_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const ALLOWED_RPC_HOSTS = new Set(['ethereum-sepolia-rpc.publicnode.com', 'sepolia.infura.io', 'eth-sepolia.g.alchemy.com']);
const windows = new Map();

function configuredRpc() {
  const value = process.env.PORTAL_SEPOLIA_RPC_URL || DEFAULT_RPC;
  const url = new URL(value);
  if (url.protocol !== 'https:' || !ALLOWED_RPC_HOSTS.has(url.hostname)) throw new Error('RPC source is not allowlisted');
  return url;
}

function sourceProjection(url) {
  return { provider_id: process.env.PORTAL_SEPOLIA_RPC_PROVIDER_ID || url.hostname, origin: url.origin, credentials_exposed: false };
}

function limited(req) {
  const key = crypto.createHash('sha256').update(String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0]).digest('hex');
  const now = Date.now();
  const current = windows.get(key);
  if (!current || now - current.started > 60_000) { windows.set(key, { started: now, count: 1 }); return false; }
  current.count += 1;
  return current.count > 10;
}

function rpcClient(url) {
  let sequence = 0;
  return async (method, params) => {
    const response = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method, params }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > 1_000_000) throw new Error('RPC response exceeded 1 MB');
    const body = JSON.parse(text);
    if (body.error) throw new Error(`RPC ${body.error.code || 'error'}`);
    return body.result;
  };
}

export async function handleEvidenceLab(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (limited(req)) { res.setHeader('Retry-After', '60'); return res.status(429).json({ error: 'Rate limit exceeded' }); }
  if (!req.body || JSON.stringify(req.body).length > 20_000) return res.status(413).json({ error: 'Request too large' });
  try {
    const rpc = configuredRpc();
    const report = await verifyTransaction(req.body, { rpcCall: rpcClient(rpc), source: sourceProjection(rpc) });
    return res.status(200).json(report);
  } catch (error) {
    if (error instanceof EvidenceInputError) return res.status(400).json({ error: error.message });
    console.error(JSON.stringify({ level: 'error', message: 'evidence_lab_failed', error: String(error?.message || 'unknown') }));
    return res.status(503).json({ error: 'Evidence source unavailable. No verification result was issued.' });
  }
}
