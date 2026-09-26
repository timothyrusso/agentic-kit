import * as tsParser from '@typescript-eslint/parser';
import type { Linter } from 'eslint';
import type { LintKitConfig } from '../kitConfig.js';
import { plugin } from '../plugin.js';
import type { rules as ruleModules } from '../rules/index.js';

/** The namespace the recommended config registers the plugin under: rules read `arch/<rule>`. */
export const PLUGIN_NAMESPACE = 'arch';

const EXTENSIONS = '{js,jsx,mjs,cjs,ts,tsx,mts,cts}';

/** Every file the recommended config lints. */
export const SOURCE_FILES = `**/*.${EXTENSIONS}`;

/** `no-restricted-syntax` entries: no TypeScript `enum`, no `as Error`. */
export const RESTRICTED_SYNTAX = [
  {
    selector: 'TSEnumDeclaration',
    message: 'Use a union of string literals or an `as const` object, not `enum`.',
  },
  {
    selector: "TSAsExpression > TSTypeReference.typeAnnotation > Identifier[name='Error']",
    message: 'Do not cast to Error: narrow with `instanceof` or convert with a helper.',
  },
] as const;

/** The folder of the design system, which owns the spinner and the spacing scale. */
function designSystemRoot(featuresRoot: string): string {
  return `${featuresRoot}/core/design-system`;
}

/**
 * The kit's flat config for an app, driven by its `kit.config.json`. Spread it into
 * `eslint.config.js`; override a rule in a later block.
 *
 * - Always: the ViewModel rules (`prefer-viewmodel` allows `lint.allowedHooksInViews`),
 *   `no-inline-comments`, `no-jsx-comment-text`, `stable-row-handlers`, `no-effect-in-views`,
 *   `no-effect-run-in-facades`, `no-relative-imports` and `no-restricted-syntax` for `enum` and
 *   `as Error`.
 * - `lint.dashes` is not `allow`: `no-dashes`.
 * - `lint.layoutTokens`: `no-literal-gutter` in `appRoot` and `<featuresRoot>/core/design-system`.
 * - `lint.singleSpinner`: `no-restricted-imports` for `ActivityIndicator`, outside the design system.
 */
export function recommended(kitConfig: LintKitConfig = {}): Linter.Config[] {
  const appRoot = kitConfig.appRoot ?? 'app';
  const featuresRoot = kitConfig.featuresRoot ?? 'features';
  const lint = kitConfig.lint ?? {};
  const designSystem = designSystemRoot(featuresRoot);
  const prefix = (rule: keyof typeof ruleModules) => `${PLUGIN_NAMESPACE}/${rule}`;

  const rules: Linter.RulesRecord = {
    [prefix('viewmodel-return-shape')]: 'error',
    [prefix('prefer-viewmodel')]: ['error', { allow: [...(lint.allowedHooksInViews ?? [])] }],
    [prefix('no-inline-comments')]: 'error',
    [prefix('no-jsx-comment-text')]: 'error',
    [prefix('stable-row-handlers')]: 'error',
    [prefix('no-effect-in-views')]: 'error',
    [prefix('no-effect-run-in-facades')]: 'error',
    [prefix('no-relative-imports')]: 'error',
    'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX],
  };
  if (lint.dashes !== 'allow') rules[prefix('no-dashes')] = 'error';
  if (lint.singleSpinner) {
    rules['no-restricted-imports'] = [
      'error',
      {
        paths: [
          {
            name: 'react-native',
            importNames: ['ActivityIndicator'],
            message: `Use the design system spinner from ${designSystem}.`,
          },
        ],
      },
    ];
  }

  const configs: Linter.Config[] = [
    {
      name: `${PLUGIN_NAMESPACE}/recommended`,
      files: [SOURCE_FILES],
      plugins: { [PLUGIN_NAMESPACE]: plugin },
      languageOptions: {
        parser: tsParser,
        sourceType: 'module',
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      rules,
    },
  ];

  if (lint.singleSpinner) {
    configs.push({
      name: `${PLUGIN_NAMESPACE}/recommended/design-system-spinner`,
      files: [`${designSystem}/**/*.${EXTENSIONS}`],
      rules: { 'no-restricted-imports': 'off' },
    });
  }

  if (lint.layoutTokens) {
    const { gutterToken, spacingImport, allowlistFile } = lint.layoutTokens;
    configs.push({
      name: `${PLUGIN_NAMESPACE}/recommended/layout`,
      files: [`${appRoot}/**/*.{ts,tsx}`, `${designSystem}/**/*.{ts,tsx}`],
      rules: { [prefix('no-literal-gutter')]: ['error', { gutterToken, spacingImport, allowlistFile }] },
    });
  }

  return configs;
}
