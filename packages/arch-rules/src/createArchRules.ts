import type { IConfiguration } from 'dependency-cruiser';
import { generateEffectRules } from './effectRules.js';
import { type FeatureTiers, findFeatureTiers } from './featureTiers.js';
import { generateIndexBoundaryRules } from './indexBoundaryRules.js';
import { generateLayerRules } from './layerRules.js';
import { type ArchKitConfig, type ArchRule, escapeRegex } from './paths.js';
import { generateTierRules } from './tierRules.js';

/** Feature folders whose public API a `.tsx` may import at runtime, relative to `featuresRoot`. */
export const DEFAULT_TSX_PUBLIC_API_EXCEPTIONS = ['core/navigation', 'core/design-system'] as const;

/** Feature folders whose public API `domain/` may import at runtime, relative to `featuresRoot`. */
export const DEFAULT_DOMAIN_PUBLIC_API_EXCEPTIONS = ['core/error'] as const;

export interface ArchRulesOptions {
  /** App root that `featuresRoot` and `appRoot` are relative to. Defaults to `process.cwd()`. */
  readonly rootDir?: string;
  /** Tiers to use instead of scanning each feature's `index.ts`. */
  readonly featureTiers?: FeatureTiers;
  /** Defaults to `DEFAULT_TSX_PUBLIC_API_EXCEPTIONS`. An empty list allows none. */
  readonly tsxPublicApiExceptions?: readonly string[];
  /** Defaults to `DEFAULT_DOMAIN_PUBLIC_API_EXCEPTIONS`. An empty list allows none. */
  readonly domainPublicApiExceptions?: readonly string[];
}

/**
 * The dependency-cruiser `forbidden` array for an app: tier rules and index boundary rules per
 * feature (from each feature's `FEATURE_TIER`), the layer rules, and the Effect placement rules.
 */
export function createArchRules(config: ArchKitConfig, options: ArchRulesOptions = {}): ArchRule[] {
  const featureTiers = options.featureTiers ?? findFeatureTiers(options.rootDir ?? process.cwd(), config.featuresRoot);
  return [
    ...generateTierRules(featureTiers),
    ...generateIndexBoundaryRules(featureTiers),
    ...generateLayerRules({
      featuresRoot: config.featuresRoot,
      appRoot: config.appRoot,
      tsxPublicApiExceptions: options.tsxPublicApiExceptions ?? DEFAULT_TSX_PUBLIC_API_EXCEPTIONS,
      domainPublicApiExceptions: options.domainPublicApiExceptions ?? DEFAULT_DOMAIN_PUBLIC_API_EXCEPTIONS,
    }),
    ...generateEffectRules({ featuresRoot: config.featuresRoot, appRoot: config.appRoot }),
  ];
}

export interface DependencyCruiserConfigOptions extends ArchRulesOptions {
  /** tsconfig the resolver reads path aliases from. Defaults to `tsconfig.json`. */
  readonly tsConfigFile?: string;
}

/**
 * A complete dependency-cruiser configuration: `createArchRules` plus the resolver and reporter
 * options an Expo app needs. Use it as the whole `.dependency-cruiser.js`:
 *
 * ```js
 * import { createDependencyCruiserConfig } from '@timothyrusso/arch-rules';
 * import { loadKitConfig } from '@timothyrusso/config-presets';
 *
 * export default createDependencyCruiserConfig(loadKitConfig());
 * ```
 */
export function createDependencyCruiserConfig(
  config: ArchKitConfig,
  options: DependencyCruiserConfigOptions = {},
): IConfiguration {
  const roots = `(?:${escapeRegex(config.featuresRoot)}|${escapeRegex(config.appRoot)})`;
  return {
    forbidden: createArchRules(config, options),
    options: {
      doNotFollow: { path: ['node_modules'] },
      tsPreCompilationDeps: true,
      tsConfig: { fileName: options.tsConfigFile ?? 'tsconfig.json' },
      enhancedResolveOptions: {
        exportsFields: ['exports'],
        conditionNames: ['react-native', 'import', 'require', 'node', 'default', 'types'],
        mainFields: ['main', 'types', 'typings'],
      },
      skipAnalysisNotInRules: true,
      reporterOptions: {
        dot: { collapsePattern: 'node_modules/(?:@[^/]+/[^/]+|[^/]+)' },
        archi: { collapsePattern: `^${roots}/[^/]+|node_modules/(?:@[^/]+/[^/]+|[^/]+)` },
        text: { highlightFocused: true },
      },
    },
  };
}
