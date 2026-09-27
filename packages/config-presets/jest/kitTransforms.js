/**
 * The `@timothyrusso/*` packages ship ES modules, so they must be transformed like the Expo ones.
 * Kept out of `preset.js` because jest treats every export of a preset module as a config option.
 */
const KIT_SCOPE = '@timothyrusso';

/**
 * Adds the kit's npm scope to the `transformIgnorePatterns` of a jest-expo preset, so Babel
 * transforms `@timothyrusso/*` like the Expo packages. Returns `undefined` when the preset has no
 * patterns to extend.
 */
function withKitTransforms(expoPreset) {
  const patterns = expoPreset?.transformIgnorePatterns;
  if (!Array.isArray(patterns)) return undefined;
  return patterns.map(pattern => pattern.replace(/(\/?node_modules\/\(\?!\()/, `$1${KIT_SCOPE}|`));
}

module.exports = { withKitTransforms };
