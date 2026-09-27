import { readFileSync } from 'node:fs';
import { createArchRules } from '../createArchRules.js';
import { findFeatureTiers } from '../featureTiers.js';
import type { ArchRule } from '../paths.js';
import { type FixtureTree, removeFixtures, writeFixture } from './helpers.js';

/**
 * `reference-tree.json` is the file listing of a real app's `features/` folder with each
 * feature's `FEATURE_TIER`; `reference-rules.json` is what that app's original generator produced
 * for it (rule comments left out, since the kit rewords them). The kit must produce the same rules,
 * plus its Effect rules.
 */
interface ReferenceTree {
  featuresRoot: string;
  appRoot: string;
  tiers: Record<string, number>;
  files: string[];
}

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8'));
const reference = fixture('reference-tree.json') as ReferenceTree;
const expectedRules = fixture('reference-rules.json') as Omit<ArchRule, 'comment'>[];

const EFFECT_RULES = ['domain-pure-except-effect', 'effect-only-in-inner-layers', 'facades-run-through-boundary'];

function synthesise(): string {
  const tree: Record<string, string> = {};
  for (const file of reference.files) tree[file] = '';
  for (const [feature, tier] of Object.entries(reference.tiers)) {
    tree[`${feature}/index.ts`] =
      `import type { FeatureTier } from '@/features/core/featureTier';\n\nexport const FEATURE_TIER: FeatureTier = ${tier};\n`;
  }
  return writeFixture(tree satisfies FixtureTree);
}

function withoutComment({ comment: _comment, ...rule }: ArchRule): Omit<ArchRule, 'comment'> {
  return rule;
}

const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name);

afterAll(removeFixtures);

describe('reference tree', () => {
  it('reads the same feature tiers', () => {
    const root = synthesise();
    expect(findFeatureTiers(root, reference.featuresRoot)).toEqual(reference.tiers);
  });

  it('produces the same rules as the original generator, plus the Effect rules', () => {
    const root = synthesise();
    const rules = createArchRules(
      { featuresRoot: reference.featuresRoot, appRoot: reference.appRoot },
      { rootDir: root },
    );

    const shared = rules
      .filter(rule => !EFFECT_RULES.includes(rule.name))
      .map(withoutComment)
      .sort(byName);
    expect(shared).toEqual([...expectedRules].sort(byName));

    const added = rules.filter(rule => EFFECT_RULES.includes(rule.name)).map(rule => rule.name);
    expect(added.sort()).toEqual(EFFECT_RULES);
  });

  it('gives every rule a comment and an error severity', () => {
    const rules = createArchRules({ featuresRoot: 'features', appRoot: 'app' }, { featureTiers: { 'features/a': 1 } });
    for (const rule of rules) {
      expect(rule.comment.length).toBeGreaterThan(0);
      expect(rule.severity).toBe('error');
    }
  });
});
