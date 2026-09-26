import { FEATURE_TIERS, type FeatureTier, type FeatureTiers } from './featureTiers.js';
import { type ArchRule, escapeRegex, slug } from './paths.js';

function forbiddenTiersFor(tier: FeatureTier): readonly FeatureTier[] {
  return tier === 0 ? FEATURE_TIERS.filter(t => t > 0) : FEATURE_TIERS.filter(t => t >= tier);
}

/**
 * One `no-tier-violation-<feature>` rule per feature that has something above it: a feature
 * imports only strictly lower tiers, and Tier 0 may import Tier 0.
 */
export function generateTierRules(featureTiers: FeatureTiers): ArchRule[] {
  const featuresByTier = new Map<FeatureTier, string[]>();
  for (const [featurePath, tier] of Object.entries(featureTiers)) {
    const peers = featuresByTier.get(tier) ?? [];
    peers.push(featurePath);
    featuresByTier.set(tier, peers);
  }

  return Object.entries(featureTiers).flatMap(([featurePath, tier]): ArchRule[] => {
    const forbiddenPaths = forbiddenTiersFor(tier).flatMap(t =>
      (featuresByTier.get(t) ?? []).map(f => `^${escapeRegex(f)}/`),
    );
    if (forbiddenPaths.length === 0) return [];

    const own = `^${escapeRegex(featurePath)}/`;
    return [
      {
        name: `no-tier-violation-${slug(featurePath)}`,
        comment:
          tier === 0
            ? 'Tier 0 (core): import only Tier 0 peers; never a feature of Tier 1 or above'
            : `Tier ${tier}: import only strictly lower tiers; never a Tier ${tier} peer or a higher tier`,
        severity: 'error',
        from: { path: own },
        to: { path: forbiddenPaths.join('|'), pathNot: own },
      },
    ];
  });
}
