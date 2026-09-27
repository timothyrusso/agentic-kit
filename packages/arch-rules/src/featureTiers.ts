import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/** Every tier a feature may declare, lowest first. */
export const FEATURE_TIERS = [0, 1, 2, 3, 4, 5] as const;

/**
 * A feature's position in the dependency order. A feature imports only strictly lower tiers;
 * Tier 0 (core) may also import Tier 0.
 */
export type FeatureTier = (typeof FEATURE_TIERS)[number];

/** Feature folder (relative to the app root, e.g. `features/trips`) to its declared tier. */
export type FeatureTiers = Readonly<Record<string, FeatureTier>>;

/** Thrown when a feature's `index.ts` declares a tier outside `FEATURE_TIERS`. */
export class FeatureTierError extends Error {
  override readonly name = 'FeatureTierError';
}

const TIER_REGEX = /export const FEATURE_TIER(?:\s*:\s*FeatureTier)?\s*=\s*(\d+)/;

function isFeatureTier(value: number): value is FeatureTier {
  return (FEATURE_TIERS as readonly number[]).includes(value);
}

/**
 * Reads the tier of every feature under `featuresRoot`: each folder, one or two levels deep
 * (`features/<name>` and `features/core/<concern>`), whose `index.ts` declares `FEATURE_TIER`.
 * Keys are relative to `rootDir` with forward slashes, sorted.
 */
export function findFeatureTiers(rootDir: string, featuresRoot: string): FeatureTiers {
  const root = resolve(rootDir);
  const results: Record<string, FeatureTier> = {};

  const walk = (dir: string, depth: number): void => {
    if (depth > 1) return;
    const entries = readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();
    for (const name of entries) {
      const fullPath = join(dir, name);
      const indexPath = join(fullPath, 'index.ts');
      if (existsSync(indexPath)) {
        const match = readFileSync(indexPath, 'utf8').match(TIER_REGEX);
        if (match?.[1] !== undefined) {
          const tier = Number.parseInt(match[1], 10);
          const featurePath = relative(root, fullPath).replace(/\\/g, '/');
          if (!isFeatureTier(tier)) {
            throw new FeatureTierError(
              `${featurePath}/index.ts declares FEATURE_TIER = ${tier}; tiers are ${FEATURE_TIERS.join(', ')}.`,
            );
          }
          results[featurePath] = tier;
        }
      }
      walk(fullPath, depth + 1);
    }
  };

  const featuresDir = join(root, featuresRoot);
  if (existsSync(featuresDir)) walk(featuresDir, 0);
  return results;
}
