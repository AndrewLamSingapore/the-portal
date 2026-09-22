/**
 * Card permalink browser check.
 *
 * Serves the real client and styles from the working tree against stubbed
 * /api/* responses, then drives Microsoft Edge through the permalink journey:
 * front door -> open a card -> copy link -> close -> deep link -> browser back
 * -> unknown card id. Records console errors and acceptance screenshots.
 *
 * Opt-in (never part of CI): it needs a Chromium-family browser on the host.
 *
 *   node scripts/card-permalink-browser.mjs
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PORT = Number(process.env.PORTAL_CHECK_PORT || 4191);
const SHOTS = process.env.PORTAL_CHECK_SHOTS || path.join(tmpdir(), 'portal-v2-shots');
const EDGE_PATHS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

const ARTIFACTS = [
  {
    id: 'container-telegraph',
    title: 'The Container Telegraph',
    year: '1974',
    status: 'ARRIVED',
    persistence: 'ARCHIVE',
    evidence_level: 'HISTORICALLY-VERIFIED',
    description: 'A proposed port-wide telegraph that would announce every container movement.',
    provenance: 'Curator-reviewed record with a public source trail.',
    imagined_future: 'Ports coordinated berths and trucks from one shared signal rather than by telephone.',
    problem: 'Berth and truck handovers depended on calls nobody could audit.',
    modern_descendant: 'Terminal operating systems and appointment scheduling.',
    concepts: ['logistics', 'coordination', 'telecommunications'],
    unresolved_question: 'Which parts of coordination still fail because the signal arrives too late?',
    sources: [{ title: 'Port operations review', url: 'https://example.org/source-one' }],
    relationships: [{ type: 'ENABLES', label: 'Container appointment scheduling' }],
    connections: [{ type: 'BRANCHES_TO', target_id: 'quiet-arrival', reason: 'Both depend on shared arrival signals.' }],
    lifecycle: [{ year: '1974', phase: 'EMERGED', description: 'First proposal published.', evidence_basis: 'SOURCE' }],
    recurrence_conditions: ['Congestion returns'],
  },
  {
    id: 'quiet-arrival',
    title: 'The Quiet Arrival',
    year: '2019',
    status: 'EXPLORING',
    persistence: 'DRAFT',
    evidence_level: 'AI-CURATED',
    description: 'A generated prompt about cargo that announces itself before it is seen.',
    provenance: 'Not supplied.',
    imagined_future: 'Inbound freight declares its own risk level before arrival.',
    problem: 'Risk signals arrive after the container is already on the quay.',
    modern_descendant: 'Predictive arrival analytics.',
    concepts: ['logistics', 'forecasting'],
    unresolved_question: 'Would earlier signals change any decision, or only the paperwork?',
    sources: [],
    relationships: [],
    connections: [],
    lifecycle: [],
    recurrence_conditions: [],
  },
];

const GRAPH = {
  nodes: ARTIFACTS.map(({ id, title, year, concepts }) => ({ id, title, year, concepts })),
  edges: [{ from: 'container-telegraph', to: 'quiet-arrival', type: 'BRANCHES_TO', reason: 'Shared arrival signals.' }],
};

const json = (response, payload, status = 200) => {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
};

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/api/archive') {
    return json(response, { artifacts: ARTIFACTS, count: ARTIFACTS.length, temporal_graph: GRAPH });
  }
  if (url.pathname === '/api/graph') return json(response, GRAPH);
  if (url.pathname === '/api/health') return json(response, { ok: true, product_version: '6.5.0' });
  if (url.pathname === '/api/trial') return json(response, { counts: { FAILED: 1, TOO_EARLY: 0, ARRIVED_QUIETLY: 2 } });
  if (url.pathname.startsWith('/api/')) return json(response, { ok: false, error: 'stub' }, 200);

  const relative = url.pathname === '/' || url.pathname.startsWith('/card/') ? 'index.html' : url.pathname.slice(1);
  const target = path.join(ROOT, relative);
  try {
    if (!statSync(target).isFile()) throw new Error('not a file');
    const type = target.endsWith('.css') ? 'text/css'
      : target.endsWith('.js') || target.endsWith('.mjs') ? 'text/javascript'
        : target.endsWith('.webp') ? 'image/webp'
          : target.endsWith('.mp3') ? 'audio/mpeg'
            : 'text/html';
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    response.end(readFileSync(target));
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('not found');
  }
});

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`);
};
const step = async (name, body) => {
  try {
    await body();
  } catch (error) {
    record(name, false, `${error.name}: ${String(error.message).split('\n')[0]}`);
  }
};

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('SKIP  playwright is not installed; run npm install first.');
  process.exit(0);
}

const launchOptions = EDGE_PATHS.find((candidate) => existsSync(candidate))
  ? { executablePath: EDGE_PATHS.find((candidate) => existsSync(candidate)) }
  : { channel: 'msedge' };

mkdirSync(SHOTS, { recursive: true });
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

const browser = await chromium.launch({ ...launchOptions, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text().slice(0, 200));
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

const base = `http://127.0.0.1:${PORT}`;
const drawerOpen = () => page.evaluate(() => document.getElementById('drawer').classList.contains('open'));

await step('front door and card journey', async () => {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#grid .card', { timeout: 20000 });
  const frontDoor = await page.locator('#howToRead').textContent();
  record('the front door states what the Portal is', frontDoor.includes('A museum of imagined futures') && frontDoor.includes('HOW TO READ A CARD'), frontDoor.slice(0, 90).trim());
  record('the front door explains outcome, evidence label and open question', ['OUTCOME OR STATUS', 'EVIDENCE LABEL', 'OPEN QUESTION'].every((token) => frontDoor.includes(token)));
  await page.screenshot({ path: path.join(SHOTS, '01-front-door.png'), fullPage: false });

  await page.locator('#grid .card').first().click();
  await page.waitForFunction(() => document.getElementById('drawer').classList.contains('open'));
  record('opening a card records a stable /card/<id> link', page.url().endsWith('/card/container-telegraph'), page.url());
  record('the open card updates the document title', (await page.title()).includes('The Container Telegraph'), await page.title());
  const canonical = await page.getAttribute('link[rel="canonical"]', 'href');
  record('the open card sets its canonical link', String(canonical).endsWith('/card/container-telegraph'), String(canonical));
  record('the drawer offers a copy-link control', await page.locator('#copyCardLink').isVisible());

  await page.locator('#copyCardLink').click();
  await page.waitForTimeout(400);
  const copyState = (await page.locator('#copyCardState').textContent()).trim();
  record('copy link reports success or a readable fallback', /Link copied|Copy this link/.test(copyState), copyState.slice(0, 90));
  await page.screenshot({ path: path.join(SHOTS, '02-card-open.png'), fullPage: false });

  await page.locator('#closeDrawer').click();
  await page.waitForTimeout(400);
  record('closing the card returns to the exhibition URL', page.url() === `${base}/`, page.url());
  record('closing the card closes the drawer', (await drawerOpen()) === false);
  record('closing the card restores the exhibition title', (await page.title()).includes('Living Knowledge System'), await page.title());
});

await step('deep link, history and unknown card', async () => {
  await page.goto(`${base}/card/quiet-arrival`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('drawer').classList.contains('open'), null, { timeout: 20000 });
  const title = await page.locator('#drawerTitle').textContent();
  record('a shared /card/<id> link opens that card on first load', title.trim() === 'The Quiet Arrival', title);
  await page.screenshot({ path: path.join(SHOTS, '03-deep-link.png'), fullPage: false });

  await page.goBack();
  await page.waitForTimeout(600);
  record('browser back leaves the card', (await drawerOpen()) === false || page.url().endsWith('/'), `${page.url()} open=${await drawerOpen()}`);

  await page.goto(`${base}/card/not-a-real-card`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const notice = await page.locator('#cardNotice');
  record('an unknown card id is answered in the exhibition', (await notice.isVisible()) && (await notice.textContent()).includes('No card is filed'), ((await notice.textContent()) || '').slice(0, 90));
  await page.screenshot({ path: path.join(SHOTS, '04-unknown-card.png'), fullPage: false });
});

record('no runtime errors during the card journey', errors.length === 0, errors.slice(0, 3).join(' | '));

await context.close();
await browser.close();
server.close();

const reportPath = path.join(SHOTS, 'card-permalink-report.json');
writeFileSync(reportPath, JSON.stringify({ base, results, shots: SHOTS, errors }, null, 2));
const failures = results.filter((result) => !result.pass);
console.log(`\n${results.length - failures.length}/${results.length} card checks passed. Report: ${reportPath}`);
process.exit(failures.length === 0 ? 0 : 1);
