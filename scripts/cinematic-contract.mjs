import assert from 'node:assert/strict';import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8'),js=fs.readFileSync('cinematic.js','utf8'),css=fs.readFileSync('cinematic.css','utf8');
assert.match(html,/id="portalCinematic"/);assert.match(html,/id="cinematicSkip"/);assert.match(html,/id="cinematicReplay"/);
assert.match(js,/sessionStorage/);assert.match(js,/prefers-reduced-motion/);assert.match(js,/event\.key==='Escape'/);
assert.match(css,/prefers-reduced-motion/);assert.match(css,/body\.cinematic-locked/);
assert.match(html,/portal-cinematic\.webp/);assert.match(html,/class="cinematic-art"/);assert.match(html,/A living knowledge system/);
assert.ok(fs.statSync('portal-cinematic.webp').size<350000,'cinematic artwork must remain web optimized');
console.log('Portal cinematic opening contract: PASS');
