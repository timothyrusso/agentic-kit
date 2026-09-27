#!/usr/bin/env node
/**
 * `schema/kit.config.schema.json` is the source of truth. `config-presets` ships a copy next to
 * its loader so the published package is self-contained.
 *
 *   node scripts/sync-schema.js           copy the root schema into the package
 *   node scripts/sync-schema.js --check   fail when the copy has drifted (part of `npm run check`)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'schema/kit.config.schema.json';
const COPY = 'packages/config-presets/src/kitConfig.schema.json';

const source = readFileSync(SOURCE, 'utf8');

if (process.argv.includes('--check')) {
  let copy = '';
  try {
    copy = readFileSync(COPY, 'utf8');
  } catch {
    copy = '';
  }
  if (copy !== source) {
    console.error(`FAIL: ${COPY} differs from ${SOURCE}. Run \`npm run sync:schema\`.`);
    process.exit(1);
  }
  process.exit(0);
}

writeFileSync(COPY, source);
console.log(`Copied ${SOURCE} to ${COPY}`);
