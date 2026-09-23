#!/usr/bin/env node
/**
 * Publish one private PRIME report to the Portal's ingestion route.
 *
 * This is the producer side of the private domain: a machine producer (PRIME on
 * ABEX, or an owner-authorised acceptance runner) pushes a report outward over
 * authenticated HTTPS. The credential is read from the environment only - never
 * from an argument, a file or a log - and is sent as a bearer credential that the
 * server turns into a digest before it reaches the database.
 *
 * Fails closed: with no credential or no endpoint the script refuses to send
 * anything and says exactly which environment variables are missing.
 */
import { readFile } from 'node:fs/promises';
import process from 'node:process';

import { reportDigest, validateReport } from '../lib/prime-reports.js';

const DEFAULT_URL = 'https://the-portal-ten.vercel.app/api/prime/publish';
const TOKEN_VARS = ['PORTAL_PRIME_PUBLISH_TOKEN'];
const URL_VARS = ['PORTAL_PRIME_PUBLISH_URL'];

function parseArgs(argv) {
  const options = { agents: [], artifacts: [], claims: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`missing value for ${arg}`);
      return argv[index];
    };
    switch (arg) {
      case '--file': options.file = next(); break;
      case '--id': options.id = next(); break;
      case '--objective': options.objective = next(); break;
      case '--summary': options.summary = next(); break;
      case '--status': options.status = next(); break;
      case '--visibility': options.visibility = next(); break;
      case '--mission-id': options.mission_id = next(); break;
      case '--task-id': options.task_id = next(); break;
      case '--parent-task-id': options.parent_task_id = next(); break;
      case '--agent': options.agents.push(next()); break;
      case '--artifact': options.artifacts.push(next()); break;
      case '--claim': options.claims.push(next()); break;
      case '--url': options.url = next(); break;
      case '--dry-run': options.dryRun = true; break;
      case '--help': options.help = true; break;
      default: throw new Error(`unknown argument ${arg}`);
    }
  }
  return options;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/publish-prime-report.mjs --file report.json [--dry-run]',
    '  node scripts/publish-prime-report.mjs --id PTL-RPT-... --objective "..." --status PARTIAL \\',
    '       [--summary "..."] [--visibility OWNER|MEMBER] [--agent a17] [--claim "..."] [--artifact "..."]',
    '',
    `Endpoint: --url, or ${URL_VARS.join('/')}, or ${DEFAULT_URL}`,
    `Credential: ${TOKEN_VARS.join('/')} (environment only; never printed or logged)`,
  ].join('\n');
}

function buildReport(options) {
  return {
    id: options.id,
    objective: options.objective,
    summary: options.summary,
    status: options.status,
    visibility: options.visibility,
    mission_id: options.mission_id,
    task_id: options.task_id,
    parent_task_id: options.parent_task_id,
    agents: options.agents.length ? options.agents : undefined,
    artifacts: options.artifacts.length ? options.artifacts : undefined,
    claims: options.claims.length ? options.claims : undefined,
  };
}

function stripUndefined(report) {
  return Object.fromEntries(Object.entries(report).filter(([, value]) => value !== undefined));
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(String(error.message));
    console.error(usage());
    return 2;
  }

  if (options.help) {
    console.log(usage());
    return 0;
  }

  let report;
  if (options.file) {
    const raw = await readFile(options.file, 'utf8');
    try {
      report = JSON.parse(raw);
    } catch (error) {
      console.error(`The report file is not valid JSON: ${error.message}`);
      return 2;
    }
  } else {
    report = stripUndefined(buildReport(options));
  }

  const validation = validateReport(report);
  if (!validation.ok) {
    console.error(`The report is not acceptable: ${validation.error}`);
    return 2;
  }

  const digest = reportDigest(report);
  const endpoint = options.url || process.env[URL_VARS[0]] || DEFAULT_URL;
  const token = process.env[TOKEN_VARS[0]];

  if (options.dryRun) {
    console.log(JSON.stringify({ dry_run: true, endpoint, report_id: report.id, report_digest: digest }, null, 2));
    return 0;
  }

  if (!token) {
    console.error(`No publisher credential: set ${TOKEN_VARS.join(' or ')} in this process environment. Nothing was sent.`);
    return 2;
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error(`The publish request did not reach the Portal: ${error.message}`);
    return 1;
  }

  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }

  if (!response.ok) {
    console.error(JSON.stringify({ status: response.status, error: payload?.error || 'publish_failed', detail: payload?.detail }, null, 2));
    return 1;
  }

  console.log(JSON.stringify({
    status: response.status,
    report_id: payload?.published?.id ?? report.id,
    report_digest: digest,
    inserted: payload?.published?.inserted === true,
    publisher: payload?.published?.publisher ?? null,
    created_at: payload?.published?.created_at ?? null,
  }, null, 2));
  return 0;
}

process.exitCode = await main();
