/**
 * @timothyrusso/eslint-plugin-arch. ESLint rules for the agentic-kit architecture: ViewModel contract, comments, dashes, layout, stable row handlers, Effect in views.
 */
import { recommended } from './configs/recommended.js';
import { plugin } from './plugin.js';

export { PLUGIN_NAMESPACE, RESTRICTED_SYNTAX, recommended, SOURCE_FILES } from './configs/recommended.js';
export type { LintKitConfig } from './kitConfig.js';
export { rules } from './rules/index.js';

/** `configs.recommended(kitConfig)` builds the flat config for an app. */
export const configs = { recommended };

/** The plugin, with `configs`. The recommended config registers this same object. */
const eslintPluginArch = Object.assign(plugin, { configs });

export default eslintPluginArch;
