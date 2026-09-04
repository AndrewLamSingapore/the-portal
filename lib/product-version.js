import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

if (typeof packageJson.version !== 'string' || !packageJson.version.trim()) {
  throw new Error('package.json must define a non-empty version');
}

export const PRODUCT_VERSION = packageJson.version;
