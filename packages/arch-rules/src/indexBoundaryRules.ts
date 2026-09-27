import type { FeatureTiers } from './featureTiers.js';
import { type ArchRule, escapeRegex, slug } from './paths.js';

/**
 * One `enforce-index-boundary-<feature>` rule per feature: code outside a feature reaches it only
 * through its `index.ts` (public API) or `pages.ts` (router entry), plus its `assets/`.
 */
export function generateIndexBoundaryRules(featureTiers: FeatureTiers): ArchRule[] {
  return Object.keys(featureTiers).map(featurePath => {
    const own = escapeRegex(featurePath);
    return {
      name: `enforce-index-boundary-${slug(featurePath)}`,
      comment: `All imports into ${featurePath} from outside must go through its index.ts or pages.ts`,
      severity: 'error',
      from: { pathNot: `^${own}/` },
      to: {
        path: `^${own}/`,
        pathNot: `^${own}/(index|pages)\\.ts$|^${own}/assets/`,
      },
    };
  });
}
