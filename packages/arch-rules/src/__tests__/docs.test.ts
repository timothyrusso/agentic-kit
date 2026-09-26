import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createArchRules } from '../createArchRules.js';
import { slug } from '../paths.js';

/** The kit docs that must name every rule, read from the repository root. */
const RULE_DOCS = ['ARCHITECTURE.md', 'ERROR_HANDLING.md'];

/** One feature per tier, so every generated rule family appears at least once. */
const FEATURE_TIERS = { 'features/core/error': 0, 'features/items': 2 } as const;

function repositoryRoot(): string {
  let dir = process.cwd();
  while (!existsSync(join(dir, 'ARCHITECTURE.md'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('ARCHITECTURE.md not found above the working directory');
    dir = parent;
  }
  return dir;
}

/** A generated rule id with its feature suffix replaced by `<feature>`, as the docs write it. */
function documentedId(name: string): string {
  const feature = Object.keys(FEATURE_TIERS).find(path => name.endsWith(`-${slug(path)}`));
  return feature === undefined ? name : `${name.slice(0, -slug(feature).length)}<feature>`;
}

describe('the kit docs', () => {
  const root = repositoryRoot();
  const docs = RULE_DOCS.map(doc => readFileSync(join(root, doc), 'utf8')).join('\n');
  const ids = [
    ...new Set(
      createArchRules({ featuresRoot: 'features', appRoot: 'app' }, { featureTiers: FEATURE_TIERS }).map(rule =>
        documentedId(rule.name),
      ),
    ),
  ];

  it('covers the generated rule families', () => {
    expect(ids).toEqual(expect.arrayContaining(['no-tier-violation-<feature>', 'enforce-index-boundary-<feature>']));
  });

  it.each(ids)('name %s in ARCHITECTURE.md or ERROR_HANDLING.md', id => {
    expect(docs).toContain(`\`${id}\``);
  });
});
