import { type ArchRule, alternation, escapeRegex } from './paths.js';

export interface LayerRulesInput {
  readonly featuresRoot: string;
  readonly appRoot: string;
  /** Feature folders, relative to `featuresRoot`, whose public API a `.tsx` may import at runtime. */
  readonly tsxPublicApiExceptions: readonly string[];
  /** Feature folders, relative to `featuresRoot`, whose public API `domain/` may import at runtime. */
  readonly domainPublicApiExceptions: readonly string[];
}

function exceptionPath(features: string, folders: readonly string[]): { pathNot: string } | Record<string, never> {
  return folders.length === 0 ? {} : { pathNot: `^${features}/${alternation(folders)}/` };
}

/** The layer rules that do not depend on the feature list. */
export function generateLayerRules(input: LayerRulesInput): ArchRule[] {
  const features = escapeRegex(input.featuresRoot);
  const app = escapeRegex(input.appRoot);
  const publicApi = `^${features}/.*/index\\.ts$`;
  const tsxExceptions = input.tsxPublicApiExceptions.map(folder => `${input.featuresRoot}/${folder}`).join(', ');
  const domainExceptions = input.domainPublicApiExceptions.map(folder => `${input.featuresRoot}/${folder}`).join(', ');

  return [
    {
      name: 'tsx-no-direct-layer-import',
      comment:
        '.tsx files may only import the ViewModel (.logic.ts), UI components and styles, never facades, data, useCases, di, state, hooks, libraries or mappers directly. domain/ is allowed for import type only (see tsx-no-runtime-domain-import)',
      severity: 'error',
      from: { path: '\\.tsx$' },
      to: { path: '/(facades|data|useCases|di|state|hooks|libraries|mappers)/' },
    },
    {
      name: 'tsx-no-runtime-domain-import',
      comment:
        '.tsx files may use import type from domain/ for prop annotations, but must never import runtime values from domain/: all runtime logic flows through the ViewModel (.logic.ts)',
      severity: 'error',
      from: { path: '\\.tsx$' },
      to: { path: '/domain/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'tsx-no-cross-feature-public-api',
      comment: `.tsx files must not import runtime values from a cross-feature public API (index.ts): cross-feature runtime values flow through the ViewModel (.logic.ts). import type from any feature index.ts is allowed for prop annotations. Route and layout files in ${input.appRoot}/ are thin entry points and may import public APIs directly.${tsxExceptions ? ` Exceptions: ${tsxExceptions}.` : ''}`,
      severity: 'error',
      from: { path: '\\.tsx$', pathNot: `^${app}/` },
      to: {
        path: publicApi,
        ...exceptionPath(features, input.tsxPublicApiExceptions),
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'domain-no-outer-layer-import',
      comment:
        'domain/ is the innermost layer: it must not import from data/, useCases/, facades/, ui/, state/, hooks/, libraries/, di/ or mappers/, nor from the shared UI module design-system/',
      severity: 'error',
      from: { path: '/domain/' },
      to: { path: '/(data|useCases|facades|ui|state|hooks|libraries|di|mappers|design-system)/' },
    },
    {
      name: 'usecases-no-data-import',
      comment: 'useCases/ depend only on domain/ interfaces, never on data/ concrete implementations',
      severity: 'error',
      from: { path: '/useCases/' },
      to: { path: '/data/' },
    },
    {
      name: 'domain-no-cross-feature-runtime-import',
      comment: `domain/ files must not import runtime values from another feature's public API (index.ts). Use import type for cross-feature type references.${domainExceptions ? ` Exceptions: ${domainExceptions}.` : ''}`,
      severity: 'error',
      from: { path: '/domain/' },
      to: {
        path: publicApi,
        ...exceptionPath(features, input.domainPublicApiExceptions),
        dependencyTypes: ['import'],
      },
    },
    {
      name: 'no-circular',
      comment:
        'Circular dependencies make code hard to reason about and test: resolve them with dependency inversion or by restructuring modules',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ];
}
