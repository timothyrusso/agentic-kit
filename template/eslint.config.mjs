import { loadKitConfig } from '@timothyrusso/config-presets';
import arch from '@timothyrusso/eslint-plugin-arch';

/**
 * ESLint covers only what Biome does not: the kit's architecture rules and `no-restricted-syntax`
 * (no `enum`, no `as Error`), driven by `kit.config.json`. Written by `config-presets init`.
 *
 * `__fixtures__/` holds deliberate violations of every rule; `npm run arch:fixtures` lints it on
 * its own and checks which rules fire.
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.expo/**',
      'ios/**',
      'android/**',
      '__fixtures__/**',
    ],
  },
  ...arch.configs.recommended(loadKitConfig({ cwd: import.meta.dirname })),
];
