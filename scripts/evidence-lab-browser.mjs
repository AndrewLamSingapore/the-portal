import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { handleEvidenceLab as handler } from '../lib/evidence-lab-endpoint.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const txHash = `0x${'1'.repeat(64)}`;
const blockHash = `0x${'2'.repeat(64)}`;
const fixture = {
  eth_chainId: '0xaa36a7',
  eth_getTransactionByHash: { hash: txHash, type: '0x2', chainId: '0xaa36a7', from: `0x${'a'.repeat(40)}`, to: `0x${'b'.repeat(40)}`, nonce: '0x1', value: '0x0', input: '0x', gas: '0x5208', maxFeePerGas: '0x64', maxPriorityFeePerGas: '0x1' },
  eth_getTransactionReceipt: { transactionHash: txHash, blockHash, blockNumber: '0x10', status: '0x1', type: '0x2', from: `0x${'a'.repeat(40)}`, to: `0x${'b'.repeat(40)}`, gasUsed: '0x5208', effectiveGasPrice: '0x1' },
  eth_getBlockByHash: { number: '0x10', hash: blockHash, timestamp: '0x5' },
  eth_getBlockByNumber: { number: '0x20', hash: `0x${'3'.repeat(64)}` },
};

function bridgeResponse(res) {
  return {
    setHeader: (key, value) => res.setHeader(key, value),
    status(code) { res.statusCode = code; return this; },
    json(body) { res.end(JSON.stringify(body)); return this; },
  };
}

function safeStaticPath(requestUrl) {
  const requestedPath = requestUrl === '/' ? 'evidence-lab.html' : requestUrl.replace(/^\//, '').replace(/\?.*$/, '');
  const file = path.resolve(root, requestedPath);
  return file === root || file.startsWith(`${root}${path.sep}`) ? file : null;
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/evidence-lab' && req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const originalFetch = global.fetch;
    global.fetch = async (_url, options) => {
      const { method } = JSON.parse(options.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: fixture[method] }) };
    };
    try { await handler({ method: 'POST', headers: req.headers, socket: req.socket, body: JSON.parse(raw) }, bridgeResponse(res)); }
    finally { global.fetch = originalFetch; }
    return;
  }

  const file = safeStaticPath(req.url || '/');
  if (!file || !fs.existsSync(file)) { res.statusCode = 404; res.end('Not found'); return; }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
  res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('[name="transaction_hash"]').fill(txHash);
    await page.locator('[name="sender"]').fill(`0x${'a'.repeat(40)}`);
    await page.locator('[name="nonce"]').fill('1');
    await page.locator('[name="execution_status"]').selectOption('SUCCESS');
    await page.locator('#verifyButton').click();
    await page.locator('#results:not([hidden])').waitFor();
    assert.match(await page.locator('#summary').textContent(), /MATCH · 4/);
    assert.match(await page.locator('#reportDigest').textContent(), /[a-f0-9]{64}/);
    const layout = await page.locator('#results').evaluate(results => {
      const table = results.querySelector('table');
      const row = results.querySelector('tbody tr');
      const cells = [...row.querySelectorAll('td')];
      const panelBox = results.getBoundingClientRect();
      return {
        pageFitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
        tableMinWidth: getComputedStyle(table).minWidth,
        headerDisplay: getComputedStyle(table.querySelector('thead')).display,
        rowDisplay: getComputedStyle(row).display,
        labels: cells.map(cell => cell.dataset.label),
        values: cells.map(cell => cell.innerText),
        cellsInsidePanel: cells.every(cell => { const box = cell.getBoundingClientRect(); return box.left >= panelBox.left && box.right <= panelBox.right + 0.5; }),
      };
    });
    if (viewport.width === 390) {
      assert.equal(layout.pageFitsViewport, true, 'mobile page must not overflow horizontally');
      assert.equal(layout.tableMinWidth, '0px');
      assert.equal(layout.headerDisplay, 'none');
      assert.equal(layout.rowDisplay, 'block');
      assert.deepEqual(layout.labels, ['Check', 'Result', 'Expected', 'Observed']);
      assert.equal(layout.values[1], 'MATCH');
      assert.equal(layout.cellsInsidePanel, true, 'every stacked result field must remain inside the panel');
    } else {
      assert.equal(layout.tableMinWidth, '650px');
      assert.notEqual(layout.headerDisplay, 'none');
      assert.notEqual(layout.rowDisplay, 'block');
    }
    assert.equal(errors.length, 0, errors.join('\n'));
    if (process.env.PORTAL_EVIDENCE_SCREENSHOT && viewport.width === 390) await page.screenshot({ path: process.env.PORTAL_EVIDENCE_SCREENSHOT, fullPage: true });
    await page.close();
  }
  console.log('PASS: Evidence Lab browser → API → checker → report journey verified on desktop and iPhone viewports.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
