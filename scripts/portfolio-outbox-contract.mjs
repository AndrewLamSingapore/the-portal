import assert from 'node:assert/strict';
import { emitToPrime, portalEvent } from '../src/lib/portfolio-events.js';
const event=portalEvent('portal.experiment.completed',{verdict:'bounded'},{eventId:'portal-experiment-contract',evidenceLevel:'E2',provenance:['run:1']});
let request;
const fetchImpl=async(url,options)=>{request={url,options};return {ok:true,json:async()=>({accepted:true})};};
const result=await emitToPrime(event,{baseUrl:'https://prime.example',token:'test',fetchImpl});
assert.equal(result.delivered,true);assert.equal(request.url,'https://prime.example/api/cognitive/events');assert.equal(JSON.parse(request.options.body).schema_version,'1.0.0');
console.log('Portfolio outbox contract: OK');
