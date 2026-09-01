import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const manifest=JSON.parse(await readFile(new URL('../contracts/portfolio-contracts.manifest.json',import.meta.url)));
const targets=[...Object.entries(manifest.schemas).map(([name,hash])=>[`../contracts/${name}`,hash]),['../src/lib/generated/portfolio-contracts.js',manifest.generated['generated/javascript/validators.js']]];
for(const [path,expected] of targets){const raw=await readFile(new URL(path,import.meta.url));const content=path.endsWith('.schema.json')?JSON.stringify(JSON.parse(raw),null,2)+'\n':raw;const actual=createHash('sha256').update(content).digest('hex');if(actual!==expected)throw new Error(`Portfolio contract copy drifted: ${path}`)}
console.log('Portal portfolio contract integrity: OK');
