const preset = require('@timothyrusso/config-presets/jest');
const expo = require('jest-expo/jest-preset');

/**
 * The kit's Jest preset, plus two app deltas. `@timothyrusso/*` ships ES modules, so Babel
 * transforms it like the Expo packages; `__fixtures__/` holds deliberate violations, never tests.
 */
const config = {
  ...preset,
  transformIgnorePatterns: expo.transformIgnorePatterns.map(pattern =>
    pattern.replace('/node_modules/(?!(', '/node_modules/(?!(@timothyrusso|'),
  ),
  testPathIgnorePatterns: [...preset.testPathIgnorePatterns, '<rootDir>/__fixtures__/'],
};

module.exports = config;
