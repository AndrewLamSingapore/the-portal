import assert from 'node:assert/strict';
import test from 'node:test';
import { handleEvidenceLab as handler } from '../lib/evidence-lab-endpoint.js';

const txHash = `0x${'1'.repeat(64)}`;
const blockHash = `0x${'2'.repeat(64)}`;
const tx = { hash:txHash, type:'0x2', chainId:'0xaa36a7', from:`0x${'a'.repeat(40)}`, to:`0x${'b'.repeat(40)}`, nonce:'0x1', value:'0x0', input:'0x', gas:'0x5208', maxFeePerGas:'0x64', maxPriorityFeePerGas:'0xa', blockHash, blockNumber:'0x10', transactionIndex:'0x0' };
const receipt = { transactionHash:txHash, blockHash, blockNumber:'0x10', status:'0x1', type:'0x2', from:tx.from, to:tx.to, gasUsed:'0x5208', effectiveGasPrice:'0x32' };

function response() {
  return { statusCode:200, headers:{}, setHeader(key,value){ this.headers[key]=value; }, status(code){ this.statusCode=code; return this; }, json(body){ this.body=body; return this; } };
}

test('API performs the bounded RPC-to-report journey without exposing a configured secret path', async () => {
  const original = global.fetch;
  global.fetch = async (_url, options) => {
    const { method } = JSON.parse(options.body);
    const result = ({ eth_chainId:'0xaa36a7', eth_getTransactionByHash:tx, eth_getTransactionReceipt:receipt, eth_getBlockByHash:{number:'0x10',hash:blockHash,timestamp:'0x5'}, eth_getBlockByNumber:{number:'0x20',hash:`0x${'3'.repeat(64)}`} })[method];
    return { ok:true, status:200, text:async()=>JSON.stringify({jsonrpc:'2.0',id:1,result}) };
  };
  try {
    const req = { method:'POST', headers:{'x-forwarded-for':'api-test-success'}, body:{ transaction_hash:txHash, expectations:{ sender:tx.from, execution_status:'SUCCESS', max_fee_per_gas_wei:'100' } } };
    const res = response(); await handler(req,res);
    assert.equal(res.statusCode,200); assert.equal(res.body.checks.every(item=>item.result==='MATCH'),true);
    assert.equal(res.body.observation.source.credentials_exposed,false);
    assert.equal('path' in res.body.observation.source,false);
  } finally { global.fetch = original; }
});

test('API fails closed when the RPC source fails', async () => {
  const original = global.fetch; global.fetch = async()=>{ throw new Error('fixture provider failure'); };
  const originalError = console.error; console.error = () => {};
  try {
    const req = { method:'POST', headers:{'x-forwarded-for':'api-test-failure'}, body:{ transaction_hash:txHash, expectations:{ nonce:'1' } } };
    const res=response(); await handler(req,res); assert.equal(res.statusCode,503); assert.match(res.body.error,/No verification result/);
  } finally { global.fetch=original; console.error=originalError; }
});

test('API rejects non-POST methods and invalid declarations', async () => {
  const get=response(); await handler({method:'GET',headers:{}},get); assert.equal(get.statusCode,405);
  const bad=response(); await handler({method:'POST',headers:{'x-forwarded-for':'api-test-invalid'},body:{transaction_hash:'bad',expectations:{nonce:'1'}}},bad); assert.equal(bad.statusCode,400);
});
