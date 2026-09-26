import { createDependencyCruiserConfig } from '@timothyrusso/arch-rules';
import { loadKitConfig } from '@timothyrusso/config-presets';

/**
 * Architecture rules generated from each feature's `FEATURE_TIER` and `kit.config.json`: tiers,
 * public API boundaries, layers and Effect placement. Run by `npm run check:arch`. Written by
 * `config-presets init`.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
export default createDependencyCruiserConfig(loadKitConfig({ cwd: import.meta.dirname }), {
  rootDir: import.meta.dirname,
});
