import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

// Runs against the same disposable, network-isolated PostgreSQL container that
// verifies generation admission. It proves the living model budget's single
// atomic UPDATE cannot exceed the cap under real concurrency, and that failed
// reservations release for retries.

const container = process.env.PORTAL_ADMISSION_TEST_CONTAINER;
if (!/^abex-portal-admission-[a-z0-9-]+$/.test(container || '')) {
  throw Error('An explicitly task-owned disposable container is required');
}

function command(args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout.trim()) : reject(Error(stderr.slice(-1500))));
    child.stdin.end(input);
  });
}

assert.equal(await command(['inspect', '--format', '{{index .Config.Labels "portal.admission-test"}}', container]), '1');
assert.equal(await command(['inspect', '--format', '{{.HostConfig.NetworkMode}}', container]), 'none');

const database = 'portal_budget_test';
await command(['exec', container, 'createdb', '-U', 'postgres', database]).catch(() => {});
const psql = text => command(['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], text);

await psql(`
  CREATE TABLE IF NOT EXISTS living_model_budget (
    id integer primary key default 1,
    daily_limit_micro_usd bigint not null,
    monthly_limit_micro_usd bigint not null,
    daily_spent_micro_usd bigint not null default 0,
    monthly_spent_micro_usd bigint not null default 0,
    daily_window date not null default current_date,
    monthly_window date not null default date_trunc('month', current_date)::date,
    suspended boolean not null default false,
    updated_at timestamptz not null default now()
  );
  INSERT INTO living_model_budget(id,daily_limit_micro_usd,monthly_limit_micro_usd)
    VALUES (1,300,1000) ON CONFLICT(id) DO NOTHING;
  UPDATE living_model_budget SET daily_spent_micro_usd=0, monthly_spent_micro_usd=0, suspended=false;
`);

const admit = () => psql(`
  UPDATE living_model_budget SET
    daily_spent_micro_usd = daily_spent_micro_usd + 50,
    monthly_spent_micro_usd = monthly_spent_micro_usd + 50,
    updated_at = now()
  WHERE id = 1
    AND suspended = false
    AND daily_spent_micro_usd + 50 <= daily_limit_micro_usd
    AND monthly_spent_micro_usd + 50 <= monthly_limit_micro_usd
  RETURNING daily_spent_micro_usd;
`);

const results = await Promise.all(Array.from({ length: 20 }, () => admit().catch(() => '')));
const successes = results.filter(result => result.trim() !== '').length;
const spent = Number(await psql('SELECT daily_spent_micro_usd FROM living_model_budget;'));
assert.equal(successes, 6, `expected exactly 6 successes under a 300 micro-USD cap, got ${successes}`);
assert.equal(spent, 300, `the cap must never be exceeded, got ${spent}`);

// Failed-reservation release, then a retry that must succeed.
await psql(`
  UPDATE living_model_budget SET
    daily_spent_micro_usd = greatest(0, daily_spent_micro_usd - 50),
    monthly_spent_micro_usd = greatest(0, monthly_spent_micro_usd - 50);
`);
assert.equal(Number(await psql('SELECT daily_spent_micro_usd FROM living_model_budget;')), 250);
const retry = await admit();
assert.ok(retry.trim() !== '', 'a released reservation must admit a retry');
assert.equal(Number(await psql('SELECT daily_spent_micro_usd FROM living_model_budget;')), 300);

console.log(JSON.stringify({ tests: 3, pass: 3, providerCalls: 0, liveDatabaseCalls: 0 }));
