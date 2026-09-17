import { attachDigest, calldataDigest, canonicalDigest } from './evidence-canonical.js';

export const NETWORK = Object.freeze({
  id: 'ethereum-sepolia',
  name: 'Ethereum Sepolia',
  chain_id: '11155111',
  chain_id_hex: '0xaa36a7',
  native_unit: 'wei',
});
export const TOOL_VERSION = '1.0.0';
export const REPORT_SCHEMA = 'portal-ethereum-transaction-evidence-v1';
export const SUPPORTED_TRANSACTION_TYPES = Object.freeze(['0x0', '0x1', '0x2']);
const INTEGER = /^(0|[1-9][0-9]{0,77})$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX_BYTES = /^0x(?:[0-9a-fA-F]{2})*$/;
const EXPECTATION_KEYS = new Set([
  'sender', 'recipient', 'nonce', 'value_wei', 'calldata', 'calldata_sha256',
  'execution_status', 'gas_limit', 'gas_price_wei', 'max_fee_per_gas_wei',
  'max_priority_fee_per_gas_wei', 'timing_evidence',
]);

export class EvidenceInputError extends Error {
  constructor(message) { super(message); this.name = 'EvidenceInputError'; }
}

const decimal = (value, label) => {
  const text = String(value ?? '').trim();
  if (!INTEGER.test(text)) throw new EvidenceInputError(`${label} must be an unsigned decimal integer`);
  return text;
};
const quantity = value => value == null ? null : BigInt(value).toString(10);
const normalizeAddress = (value, label) => {
  const text = String(value ?? '').trim();
  if (!ADDRESS.test(text)) throw new EvidenceInputError(`${label} must be a 20-byte 0x address`);
  return text.toLowerCase();
};

export function normalizeDeclaration(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new EvidenceInputError('Request must be an object');
  const transactionHash = String(input.transaction_hash || '').trim().toLowerCase();
  if (!HASH.test(transactionHash)) throw new EvidenceInputError('transaction_hash must be 32-byte 0x hex');
  const raw = input.expectations;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new EvidenceInputError('expectations must be an object');
  for (const key of Object.keys(raw)) if (!EXPECTATION_KEYS.has(key)) throw new EvidenceInputError(`Unsupported expectation field: ${key}`);
  const expectations = {};
  if (raw.sender != null && String(raw.sender).trim()) expectations.sender = normalizeAddress(raw.sender, 'sender');
  if (raw.recipient != null && String(raw.recipient).trim()) {
    const recipient = String(raw.recipient).trim();
    expectations.recipient = recipient === 'CONTRACT_CREATION' ? recipient : normalizeAddress(recipient, 'recipient');
  }
  for (const key of ['nonce', 'value_wei', 'gas_limit', 'gas_price_wei', 'max_fee_per_gas_wei', 'max_priority_fee_per_gas_wei']) {
    if (raw[key] != null && String(raw[key]).trim()) expectations[key] = decimal(raw[key], key);
  }
  if (raw.calldata != null && String(raw.calldata).trim()) {
    const calldata = String(raw.calldata).trim().toLowerCase();
    if (!HEX_BYTES.test(calldata)) throw new EvidenceInputError('calldata must be even-length 0x hex');
    if (calldata.length > 131074) throw new EvidenceInputError('calldata exceeds 64 KiB');
    expectations.calldata = calldata;
  }
  if (raw.calldata_sha256 != null && String(raw.calldata_sha256).trim()) {
    const digest = String(raw.calldata_sha256).trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(digest)) throw new EvidenceInputError('calldata_sha256 must be 64 lowercase or uppercase hex characters');
    expectations.calldata_sha256 = digest;
  }
  if (raw.execution_status != null && String(raw.execution_status).trim()) {
    const status = String(raw.execution_status).trim().toUpperCase();
    if (!['SUCCESS', 'FAILURE'].includes(status)) throw new EvidenceInputError('execution_status must be SUCCESS or FAILURE');
    expectations.execution_status = status;
  }
  if (raw.timing_evidence != null && String(raw.timing_evidence).trim()) expectations.timing_evidence = String(raw.timing_evidence).slice(0, 200);
  if (!Object.keys(expectations).length) throw new EvidenceInputError('Supply at least one expectation');
  return { network: NETWORK.id, transaction_hash: transactionHash, expectations };
}

const check = (field, expected, observed, result, reason, evidence = []) => ({ field, expected, observed, result, reason, evidence });
const comparison = (field, expected, observed, evidence) => check(
  field, expected, observed, observed == null ? 'UNKNOWN' : observed === expected ? 'MATCH' : 'MISMATCH',
  observed == null ? 'Observed value is unavailable.' : observed === expected ? 'Observed value equals the supplied declaration.' : 'Observed value contradicts the supplied declaration.', evidence,
);

function unavailableChecks(expectations, reason) {
  return Object.entries(expectations).map(([field, expected]) => field === 'timing_evidence'
    ? check(field, expected, null, 'UNSUPPORTED', 'User-supplied timing text is not independent proof that the declaration existed before execution.')
    : check(field, expected, null, 'UNKNOWN', reason));
}

function retainedTransaction(tx) {
  if (!tx) return null;
  return {
    hash: tx.hash || null, type: tx.type || '0x0', chainId: tx.chainId || null,
    from: tx.from || null, to: tx.to ?? null, nonce: tx.nonce || null, value: tx.value || null,
    input: tx.input || '0x', gas: tx.gas || null, gasPrice: tx.gasPrice || null,
    maxFeePerGas: tx.maxFeePerGas || null, maxPriorityFeePerGas: tx.maxPriorityFeePerGas || null,
    blockHash: tx.blockHash || null, blockNumber: tx.blockNumber || null, transactionIndex: tx.transactionIndex || null,
  };
}

function retainedReceipt(receipt) {
  if (!receipt) return null;
  return {
    transactionHash: receipt.transactionHash || null, blockHash: receipt.blockHash || null,
    blockNumber: receipt.blockNumber || null, status: receipt.status ?? null, type: receipt.type || null,
    from: receipt.from || null, to: receipt.to ?? null, gasUsed: receipt.gasUsed || null,
    effectiveGasPrice: receipt.effectiveGasPrice || null, contractAddress: receipt.contractAddress || null,
  };
}

export async function verifyTransaction(input, context) {
  const declaration = normalizeDeclaration(input);
  const observedAt = context.observedAt || new Date().toISOString();
  const rpcCall = context.rpcCall;
  if (typeof rpcCall !== 'function') throw new TypeError('rpcCall is required');
  const declarationDigest = canonicalDigest(declaration);
  const chainId = await rpcCall('eth_chainId', []);
  const checks = [comparison('network.chain_id', NETWORK.chain_id, quantity(chainId), ['rpc.eth_chainId'])];
  let tx = null;
  let receipt = null;
  let block = null;
  let finalized = null;
  if (quantity(chainId) === NETWORK.chain_id) {
    [tx, receipt] = await Promise.all([
      rpcCall('eth_getTransactionByHash', [declaration.transaction_hash]),
      rpcCall('eth_getTransactionReceipt', [declaration.transaction_hash]),
    ]);
    if (tx?.blockHash) block = await rpcCall('eth_getBlockByHash', [tx.blockHash, false]);
    try { finalized = await rpcCall('eth_getBlockByNumber', ['finalized', false]); } catch { finalized = null; }
  }
  if (quantity(chainId) !== NETWORK.chain_id) {
    checks.push(...unavailableChecks(declaration.expectations, 'Configured RPC returned the wrong chain identity.'));
  } else if (!tx) {
    checks.push(...unavailableChecks(declaration.expectations, 'Transaction evidence is unavailable from the configured RPC source.'));
  } else {
    const inconsistent = tx.hash?.toLowerCase() !== declaration.transaction_hash
      || (receipt && receipt.transactionHash?.toLowerCase() !== declaration.transaction_hash)
      || (receipt && tx.blockHash && receipt.blockHash !== tx.blockHash)
      || (block && tx.blockHash && block.hash !== tx.blockHash);
    if (inconsistent) {
      checks.push(...unavailableChecks(declaration.expectations, 'RPC evidence is internally inconsistent.'));
    } else {
      const type = tx.type || '0x0';
      const supportedType = SUPPORTED_TRANSACTION_TYPES.includes(type);
      for (const [field, expected] of Object.entries(declaration.expectations)) {
        if (field === 'sender') checks.push(comparison(field, expected, tx.from?.toLowerCase() || null, ['transaction.from']));
        else if (field === 'recipient') checks.push(comparison(field, expected, tx.to == null ? 'CONTRACT_CREATION' : tx.to.toLowerCase(), ['transaction.to']));
        else if (field === 'nonce') checks.push(comparison(field, expected, quantity(tx.nonce), ['transaction.nonce']));
        else if (field === 'value_wei') checks.push(comparison(field, expected, quantity(tx.value), ['transaction.value']));
        else if (field === 'calldata') checks.push(comparison(field, expected, tx.input?.toLowerCase() || null, ['transaction.input']));
        else if (field === 'calldata_sha256') checks.push(comparison(field, expected, tx.input == null ? null : calldataDigest(tx.input), ['transaction.input', 'derived.calldata_sha256']));
        else if (field === 'execution_status') checks.push(comparison(field, expected, receipt?.status == null ? null : quantity(receipt.status) === '1' ? 'SUCCESS' : 'FAILURE', ['receipt.status']));
        else if (field === 'gas_limit') checks.push(supportedType ? comparison(field, expected, quantity(tx.gas), ['transaction.gas']) : check(field, expected, null, 'UNSUPPORTED', `Transaction type ${type} fee semantics are unsupported.`));
        else if (field === 'gas_price_wei') checks.push(['0x0', '0x1'].includes(type) ? comparison(field, expected, quantity(tx.gasPrice), ['transaction.gasPrice']) : check(field, expected, null, 'UNSUPPORTED', 'gas_price_wei is a legacy/access-list fee limit, not an EIP-1559 maximum.'));
        else if (field === 'max_fee_per_gas_wei') checks.push(type === '0x2' ? comparison(field, expected, quantity(tx.maxFeePerGas), ['transaction.maxFeePerGas']) : check(field, expected, null, 'UNSUPPORTED', 'max_fee_per_gas_wei is supported only for EIP-1559 type 0x2.'));
        else if (field === 'max_priority_fee_per_gas_wei') checks.push(type === '0x2' ? comparison(field, expected, quantity(tx.maxPriorityFeePerGas), ['transaction.maxPriorityFeePerGas']) : check(field, expected, null, 'UNSUPPORTED', 'max_priority_fee_per_gas_wei is supported only for EIP-1559 type 0x2.'));
        else if (field === 'timing_evidence') checks.push(check(field, expected, null, 'UNSUPPORTED', 'This release does not treat user-entered timing text as independent timing proof.'));
      }
    }
  }
  const blockNumber = tx?.blockNumber == null ? null : quantity(tx.blockNumber);
  const finalizedNumber = finalized?.number == null ? null : quantity(finalized.number);
  const finality = !tx?.blockHash ? { status: 'PENDING_OR_UNKNOWN', basis: 'No included block identity is available.' }
    : finalizedNumber == null ? { status: 'UNKNOWN', basis: 'The configured RPC did not provide a finalized block reference.' }
      : BigInt(blockNumber) <= BigInt(finalizedNumber)
        ? { status: 'FINALIZED_UNDER_RPC_SOURCE', basis: 'Transaction block number is not newer than the RPC finalized block.', finalized_block_number: finalizedNumber, finalized_block_hash: finalized.hash || null }
        : { status: 'INCLUDED_NOT_FINALIZED', basis: 'Inclusion is observed, but the transaction block is newer than the RPC finalized block.', finalized_block_number: finalizedNumber, finalized_block_hash: finalized.hash || null };
  const actualFee = receipt?.gasUsed != null && receipt?.effectiveGasPrice != null
    ? (BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice)).toString(10) : null;
  const payload = {
    schema_version: REPORT_SCHEMA,
    tool: { name: 'The Portal Evidence Lab', version: TOOL_VERSION },
    observation: {
      mode: 'LIVE_RPC_FETCH', observed_at_utc: observedAt,
      source: context.source,
      trust_assumption: 'Results rely on the configured RPC source. Re-running this checker against the same source is reproducibility evidence, not an independent audit.',
    },
    supported_scope: {
      network: NETWORK, transaction_types: SUPPORTED_TRANSACTION_TYPES,
      exclusions: ['signing', 'transaction submission', 'contract deployment', 'proxy implementation identification', 'business-outcome verification', 'pre-execution declaration timing proof'],
    },
    declaration,
    declaration_digest: { algorithm: 'SHA-256', canonical_encoding: 'portal-canonical-json-v1', value: declarationDigest },
    notice: 'Compares the observed transaction with the supplied declaration. It does not establish that the declaration existed or was authorized before execution.',
    transaction_identity: { hash: declaration.transaction_hash, observed_type: tx?.type || null },
    block_reference: tx?.blockHash ? { number: blockNumber, hash: tx.blockHash, timestamp: block?.timestamp == null ? null : quantity(block.timestamp) } : null,
    receipt_reference: receipt ? { block_number: quantity(receipt.blockNumber), block_hash: receipt.blockHash || null, status: receipt.status == null ? null : quantity(receipt.status) } : null,
    finality,
    fee_evidence: {
      maximum_settings: tx ? { gas_limit: quantity(tx.gas), gas_price_wei: quantity(tx.gasPrice), max_fee_per_gas_wei: quantity(tx.maxFeePerGas), max_priority_fee_per_gas_wei: quantity(tx.maxPriorityFeePerGas) } : null,
      actual_execution: receipt ? { gas_used: quantity(receipt.gasUsed), effective_gas_price_wei: quantity(receipt.effectiveGasPrice), actual_fee_wei: actualFee } : null,
      distinction: 'Maximum transaction fee settings are declaration limits. Actual execution fee is gas_used multiplied by effective_gas_price and may be lower.',
    },
    checks,
    retained_evidence: { transaction: retainedTransaction(tx), receipt: retainedReceipt(receipt), block: block ? { number: block.number || null, hash: block.hash || null, timestamp: block.timestamp || null } : null, finalized_block: finalized ? { number: finalized.number || null, hash: finalized.hash || null } : null },
    limitations: [
      'A matching recipient does not identify the implementation behind a proxy.',
      'A successful receipt does not prove the intended business outcome occurred.',
      'Inclusion is not finality; only the finality evidence recorded above was observed.',
      'No wallet, signature, transaction submission, contract deployment, escrow, token or real-fund capability is present.',
    ],
  };
  return attachDigest(payload);
}

