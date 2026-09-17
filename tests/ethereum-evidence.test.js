import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalDigest } from '../lib/evidence-canonical.js';
import { EvidenceInputError, verifyTransaction } from '../lib/ethereum-evidence.js';

const hash = '0x' + 'ab'.repeat(32);
const blockHash = '0x' + 'cd'.repeat(32);
const sender = '0x' + '11'.repeat(20);
const recipient = '0x' + '22'.repeat(20);
const tx = { hash, type: '0x2', chainId: '0xaa36a7', from: sender, to: recipient, nonce: '0x20000000000001', value: '0x16345785d8a0000', input: '0x1234', gas: '0x5208', gasPrice: '0x5', maxFeePerGas: '0x64', maxPriorityFeePerGas: '0x2', blockHash, blockNumber: '0x64', transactionIndex: '0x0' };
const receipt = { transactionHash: hash, blockHash, blockNumber: '0x64', status: '0x1', type: '0x2', from: sender, to: recipient, gasUsed: '0x5208', effectiveGasPrice: '0x5' };
const block = { number: '0x64', hash: blockHash, timestamp: '0x123' };
const finalized = { number: '0x65', hash: '0x' + 'ef'.repeat(32) };

function rpc(overrides = {}) {
  const values = { eth_chainId: '0xaa36a7', eth_getTransactionByHash: tx, eth_getTransactionReceipt: receipt, eth_getBlockByHash: block, eth_getBlockByNumber: finalized, ...overrides };
  return async method => {
    const value = values[method];
    if (value instanceof Error) throw value;
    return value;
  };
}
const request = expectations => ({ transaction_hash: hash, expectations });
const run = (expectations, overrides) => verifyTransaction(request(expectations), { rpcCall: rpc(overrides), source: { provider_id: 'fixture', origin: 'https://fixture.invalid', credentials_exposed: false }, observedAt: '2026-09-17T00:00:00Z' });

test('matches exact large integers, execution and EIP-1559 limits', async () => {
  const report = await run({ sender, recipient, nonce: '9007199254740993', value_wei: '100000000000000000', calldata: '0x1234', execution_status: 'SUCCESS', gas_limit: '21000', max_fee_per_gas_wei: '100', max_priority_fee_per_gas_wei: '2' });
  assert.ok(report.checks.every(item => item.result === 'MATCH'));
  assert.equal(report.fee_evidence.actual_execution.actual_fee_wei, '105000');
  assert.equal(report.finality.status, 'FINALIZED_UNDER_RPC_SOURCE');
  assert.equal(report.digest.value, canonicalDigest(Object.fromEntries(Object.entries(report).filter(([key]) => key !== 'digest'))));
});

test('reports deliberate mismatch without a broad pass badge', async () => {
  const report = await run({ recipient: sender, execution_status: 'FAILURE' });
  assert.deepEqual(report.checks.slice(1).map(item => item.result), ['MISMATCH', 'MISMATCH']);
  assert.equal('verified' in report, false);
});

test('missing transaction produces unknown requested checks', async () => {
  const report = await run({ sender }, { eth_getTransactionByHash: null, eth_getTransactionReceipt: null });
  assert.equal(report.checks.at(-1).result, 'UNKNOWN');
});

test('pending transaction never passes execution or finality', async () => {
  const pending = { ...tx, blockHash: null, blockNumber: null };
  const report = await run({ execution_status: 'SUCCESS' }, { eth_getTransactionByHash: pending, eth_getTransactionReceipt: null });
  assert.equal(report.checks.at(-1).result, 'UNKNOWN');
  assert.equal(report.finality.status, 'PENDING_OR_UNKNOWN');
});

test('reverted transaction is reported exactly', async () => {
  const report = await run({ execution_status: 'FAILURE' }, { eth_getTransactionReceipt: { ...receipt, status: '0x0' } });
  assert.equal(report.checks.at(-1).result, 'MATCH');
});

test('wrong network makes requested evidence unknown', async () => {
  const report = await run({ sender }, { eth_chainId: '0x1' });
  assert.equal(report.checks[0].result, 'MISMATCH');
  assert.equal(report.checks[1].result, 'UNKNOWN');
});

test('unsupported transaction fee type is explicit', async () => {
  const report = await run({ max_fee_per_gas_wei: '100' }, { eth_getTransactionByHash: { ...tx, type: '0x3' } });
  assert.equal(report.checks.at(-1).result, 'UNSUPPORTED');
});

test('inconsistent provider evidence becomes unknown', async () => {
  const report = await run({ sender }, { eth_getTransactionReceipt: { ...receipt, blockHash: '0x' + '00'.repeat(32) } });
  assert.equal(report.checks.at(-1).result, 'UNKNOWN');
});

test('provider errors do not create a report', async () => {
  await assert.rejects(run({ sender }, { eth_getTransactionByHash: new Error('timeout') }), /timeout/);
});

test('invalid and ambiguous inputs are rejected', async () => {
  await assert.rejects(run({ nonce: '01' }), EvidenceInputError);
  await assert.rejects(run({ unknown_fee: '1' }), EvidenceInputError);
  await assert.rejects(verifyTransaction({ transaction_hash: 'bad', expectations: { sender } }, { rpcCall: rpc(), source: {} }), EvidenceInputError);
});

test('timing claims remain unsupported', async () => {
  const report = await run({ timing_evidence: 'declared-before-use' });
  assert.equal(report.checks.at(-1).result, 'UNSUPPORTED');
});
