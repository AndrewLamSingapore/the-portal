import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { trustRelayHandler } from '../src/lib/trust-relay.js';
const calls=[];
const store={submit:async(...a)=>{calls.push(['submit',...a]);return {accepted:true};},
  claim:async()=>{calls.push(['claim']);return [];}, result:async()=>null,
  complete:async()=>({accepted:true})};
const env={PRIME_TRUST_ABEX_RELAY_TOKEN:'fixture-consumer',PRIME_TRUST_VELYQUA_RELAY_TOKEN:'fixture-producer'};
async function request(token,body,config=env){
  const res={code:200,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await trustRelayHandler(store,config)({method:'POST',headers:{authorization:token},body},res);return res;
}
assert.equal((await request('',{action:'claim'})).code,401);
assert.equal((await request('Bearer fixture-producer',{action:'claim'})).code,403);
assert.equal((await request('Bearer fixture-consumer',{action:'submit'})).code,403);
assert.equal(calls.length,0);
assert.equal((await request('Bearer fixture-consumer',{action:'claim'})).code,200);
assert.equal((await request('Bearer fixture-producer',{action:'submit',id:randomUUID(),ciphertext:'A'.repeat(64),fingerprint:'f'.repeat(64)})).code,202);
assert.equal(calls.length,2);
assert.equal((await request('Bearer fixture-producer',{action:'submit',id:'bad',ciphertext:'A'.repeat(64),fingerprint:'f'.repeat(64)})).code,422);
assert.equal((await request('Bearer fixture-producer','{')).code,422);
assert.equal((await request('Bearer fixture-consumer',{action:'complete',id:randomUUID(),ciphertext:'x'.repeat(65537)})).code,422);
assert.equal((await request('Bearer fixture-producer',{action:'claim'},{...env,PRIME_TRUST_ABEX_RELAY_TOKEN:'fixture-producer'})).code,503);
assert.equal((await request('Bearer fixture-producer',{action:'result',id:randomUUID(),fingerprint:'f'.repeat(64)})).code,404);
console.log('Encrypted trust relay: authentication, role isolation, bounds and unknown-result denial PASS');
