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
 *
 * Coverage floors apply only when jest runs with `--coverage` (`npm run test:coverage`). They are global
 * (per-file floors fail a four-line DTO at 75 percent); see the kit's TESTING.md for what is excluded.
 */
// eslint-disable-next-line arch/no-relative-imports -- a shipped CJS preset resolves its sibling inside node_modules
const { withKitTransforms } = require('./kitTransforms');

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
  collectCoverageFrom: [
    '<rootDir>/**/*.{ts,tsx}',
    '!<rootDir>/**/*.tsx',
    '!<rootDir>/**/*.style.ts',
    '!<rootDir>/**/*.d.ts',
    '!<rootDir>/**/index.ts',
    '!<rootDir>/**/pages.ts',
    '!<rootDir>/**/di/**',
    '!<rootDir>/**/libraries/**',
    '!<rootDir>/**/__tests__/**',
    '!<rootDir>/**/__fixtures__/**',
    '!<rootDir>/**/__mocks__/**',
    '!<rootDir>/app/**',
    '!<rootDir>/**/features/core/testing/**',
    '!<rootDir>/node_modules/**',
    '!<rootDir>/(ios|android|dist|coverage|.expo)/**',
  ],
  coverageThreshold: { global: { lines: 70, branches: 55, functions: 70, statements: 70 } },
};

module.exports = preset;
