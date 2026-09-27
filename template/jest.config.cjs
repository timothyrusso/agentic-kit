const preset = require('@timothyrusso/config-presets/jest');

/**
 * The kit's Jest preset (jest-expo, the `@/` alias, the `@timothyrusso/*` transform) plus one app
 * delta: `__fixtures__/` holds deliberate violations, never tests.
 */
const config = {
  ...preset,
  testPathIgnorePatterns: [...preset.testPathIgnorePatterns, '<rootDir>/__fixtures__/'],
};

module.exports = config;
