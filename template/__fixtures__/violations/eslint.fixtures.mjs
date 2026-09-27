import { loadKitConfig } from '@timothyrusso/config-presets';
import arch from '@timothyrusso/eslint-plugin-arch';

/**
 * The template's ESLint config, without the ignore of this folder. It is not named
 * `eslint.config.mjs`, so ESLint never picks it up for a fixture file linted from outside (a
 * pre-commit hook on staged files): only `--config eslint.fixtures.mjs` loads it.
 */
export default arch.configs.recommended(loadKitConfig({ cwd: import.meta.dirname }));
