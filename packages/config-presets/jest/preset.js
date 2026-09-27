/**
 * Jest for an Expo app: `jest-expo`, the `@/` alias mapped to the app root, tests in `__tests__`
 * folders, and the `@timothyrusso/*` packages transformed like the Expo ones (they ship ES
 * modules, and jest-expo's default pattern would leave them untransformed). Use it as the whole
 * config (`jest.config.cjs`):
 *
 *   module.exports = require('@timothyrusso/config-presets/jest');
 *
 * `jest-expo` is resolved from the app's own `node_modules`, at the version `npx expo install
 * jest-expo` picked for its SDK; when it is not installed the transform delta is left out, and
 * Jest cannot run anyway. An app whose alias points somewhere else overrides `moduleNameMapper` in
 * its own config.
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

// NOTE: jest-expo is the app's dependency, resolved from the app's node_modules at run time, never the
// kit's; the name is a variable so the kit's own dependency check does not try to resolve it here.
const EXPO_PRESET = 'jest-expo/jest-preset';

function expoTransforms() {
  try {
    return withKitTransforms(require(EXPO_PRESET));
  } catch {
    return undefined;
  }
}

const transformIgnorePatterns = expoTransforms();

const preset = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/**/__tests__/**/*.test.{ts,tsx,js,jsx}'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/(ios|android|dist|coverage|\\.expo)/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  ...(transformIgnorePatterns ? { transformIgnorePatterns } : {}),
};

module.exports = preset;
module.exports.withKitTransforms = withKitTransforms;
