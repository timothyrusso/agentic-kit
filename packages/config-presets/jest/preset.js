/**
 * Jest for an Expo app: `jest-expo`, the `@/` alias mapped to the app root, and tests in
 * `__tests__` folders. Use it as the whole config (`jest.config.cjs`):
 *
 *   module.exports = require('@timothyrusso/config-presets/jest');
 *
 * `preset` is resolved from the app's root, so `jest-expo` comes from the app's own
 * `node_modules` at the version `npx expo install jest-expo` picked for its SDK. An app whose alias
 * points somewhere else overrides `moduleNameMapper` in its own config.
 */
const preset = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/**/__tests__/**/*.test.{ts,tsx,js,jsx}'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/(ios|android|dist|coverage|\\.expo)/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
};

module.exports = preset;
