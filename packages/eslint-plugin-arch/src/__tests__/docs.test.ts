import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PLUGIN_NAMESPACE, recommended } from '../configs/recommended.js';
import { rules } from '../rules/index.js';

/** The kit docs that must name every rule, read from the repository root. */
const RULE_DOCS = ['ARCHITECTURE.md', 'ERROR_HANDLING.md'];

function repositoryRoot(): string {
  let dir = process.cwd();
  while (!existsSync(join(dir, 'ARCHITECTURE.md'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('ARCHITECTURE.md not found above the working directory');
    dir = parent;
  }
  return dir;
}

describe('the kit docs', () => {
  const docs = RULE_DOCS.map(doc => readFileSync(join(repositoryRoot(), doc), 'utf8')).join('\n');
  const everyOption = recommended({
    lint: {
      dashes: 'forbid',
      singleSpinner: true,
      layoutTokens: { gutterToken: 'gutter', spacingImport: '@/tokens', allowlistFile: 'layout.allow' },
    },
  });
  const ids = [
    ...new Set([
      ...Object.keys(rules).map(rule => `${PLUGIN_NAMESPACE}/${rule}`),
      ...everyOption.flatMap(config => Object.keys(config.rules ?? {})),
    ]),
  ].sort();

  it('covers the core rules the recommended config turns on', () => {
    expect(ids).toEqual(expect.arrayContaining(['no-restricted-syntax', 'no-restricted-imports']));
  });

  it.each(ids)('name %s in ARCHITECTURE.md or ERROR_HANDLING.md', id => {
    expect(docs).toContain(`\`${id}\``);
  });
});
