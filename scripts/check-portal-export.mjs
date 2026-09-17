import fs from 'node:fs';
import { verifyDocumentDigest } from '../lib/portal-export.js';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/check-portal-export.mjs <downloaded-report-or-snapshot.json>');
  process.exit(2);
}

try {
  const document = JSON.parse(fs.readFileSync(path, 'utf8'));
  const result = verifyDocumentDigest(document);
  console.log(JSON.stringify({ file: path, ...result }, null, 2));
  process.exitCode = result.valid ? 0 : 1;
} catch (error) {
  console.error(JSON.stringify({ file: path, valid: false, reason: String(error.message || error) }, null, 2));
  process.exitCode = 1;
}
