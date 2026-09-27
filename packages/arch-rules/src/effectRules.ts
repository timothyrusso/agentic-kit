import { type ArchRule, alternation, escapeRegex } from './paths.js';

/** Layers inside a feature that may use Effect. */
export const EFFECT_LAYERS = ['domain', 'data', 'useCases', 'di'] as const;

/** Core concerns, relative to the features folder, that may use Effect outside those layers. */
export const EFFECT_CORE_FOLDERS = ['core/runtime', 'core/error', 'core/testing'] as const;

/**
 * `effect` or an `@effect/*` package, whether resolved into `node_modules` or left unresolved
 * as a bare specifier.
 */
const EFFECT_MODULE = '(^|/)node_modules/(effect|@effect/[^/]+)/|^(effect|@effect/[^/]+)(/|$)';

/** The `effect` package itself, resolved or bare. */
const EFFECT_PACKAGE = '(^|/)node_modules/effect/|^effect(/|$)';

/**
 * The modules that construct or run a runtime, `effect/ManagedRuntime` and `effect/Runtime`, bare or
 * resolved to their JavaScript or declaration file.
 */
const EFFECT_RUNTIME_MODULE =
  '^effect/(ManagedRuntime|Runtime)$|(^|/)node_modules/effect/(ManagedRuntime|Runtime)(\\.d)?\\.[cm]?[jt]s$|(^|/)node_modules/effect/.*/(ManagedRuntime|Runtime)(\\.d)?\\.[cm]?[jt]s$';

export interface EffectRulesInput {
  readonly featuresRoot: string;
  readonly appRoot: string;
}

/** Where Effect may live, what `domain/` may depend on, and how facades run Effects. */
export function generateEffectRules(input: EffectRulesInput): ArchRule[] {
  const features = escapeRegex(input.featuresRoot);
  const app = escapeRegex(input.appRoot);
  const allowedCore = EFFECT_CORE_FOLDERS.map(folder => `${input.featuresRoot}/${folder}/`).join(', ');

  return [
    {
      name: 'effect-only-in-inner-layers',
      comment: `effect and @effect/* may be imported only from domain/, data/, useCases/ and di/, plus ${allowedCore}. Never from ui/, facades/, hooks/, state/ or ${input.appRoot}/: facades hand Effects to useEffectQuery and useEffectMutation`,
      severity: 'error',
      from: {
        path: `^(${features}|${app})/`,
        pathNot: `/(${EFFECT_LAYERS.join('|')})/|^${features}/${alternation(EFFECT_CORE_FOLDERS)}/`,
      },
      to: { path: EFFECT_MODULE },
    },
    {
      name: 'domain-pure-except-effect',
      comment: 'domain/ may import effect and nothing else from node_modules: it holds plain types, rules and errors',
      severity: 'error',
      from: { path: '/domain/' },
      to: { path: '(^|/)node_modules/', pathNot: EFFECT_PACKAGE },
    },
    {
      name: 'facades-run-through-boundary',
      comment: `facades/ never touch the runtime: no ${input.featuresRoot}/core/runtime/, no ManagedRuntime, no Effect.run*. They run Effects only through useEffectQuery and useEffectMutation from @timothyrusso/effect-core/react`,
      severity: 'error',
      from: { path: '/facades/' },
      to: { path: `^${features}/core/runtime/|${EFFECT_RUNTIME_MODULE}` },
    },
  ];
}
