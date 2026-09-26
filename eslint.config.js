import arch, { DEFAULT_RELATIVE_IMPORT_ALLOW, SOURCE_FILES } from '@timothyrusso/eslint-plugin-arch';
import kitConfig from './kit.config.json' with { type: 'json' };

/**
 * ESLint covers only what Biome does not: the kit's own plugin, dogfooded through its recommended
 * config (which also carries `no-restricted-syntax` for `enum` and `as Error`). `npm run lint`
 * builds the plugin first, because this file loads it from `dist/`.
 *
 * The packages are NodeNext ESM without a path alias, so relative imports are allowed inside them,
 * in their config files and in `scripts/`, on top of the root config files the default allows.
 */
export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/__tests__/fixtures/app/**'] },
  ...arch.configs.recommended(kitConfig),
  {
    files: [SOURCE_FILES],
    rules: {
      'arch/no-relative-imports': [
        'error',
        { allow: [...DEFAULT_RELATIVE_IMPORT_ALLOW, 'packages/*/src', 'packages/*/*.config.js', 'scripts'] },
      ],
    },
  },
];
