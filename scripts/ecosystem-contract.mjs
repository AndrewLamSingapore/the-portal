import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8'),links=fs.readFileSync('ecosystem-link.js','utf8'),tokens=fs.readFileSync('shared-tokens.css','utf8'),meta=fs.readFileSync('api/meta.js','utf8');
for(const value of ['the-portal-ten.vercel.app','authority-engine-app.vercel.app','game-platform-wine-nine.vercel.app','utm_source','utm_medium','utm_campaign'])assert.match(links,new RegExp(value));
assert.match(html,/shared-tokens\.css/);assert.match(html,/ecosystem-link\.js/);assert.match(links,/portal_hero/);assert.match(meta,/ecosystem_link_clicked/);assert.match(tokens,/ecosystem-nav/);
console.log('PASS: Portal ecosystem alignment contract verified.');
