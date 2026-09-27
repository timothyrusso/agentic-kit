/**
 * Shared Jest settings for every package. Sources are ESM TypeScript; tests run through SWC as
 * CommonJS so Jest needs no experimental VM modules flag. The `.js` suffix that NodeNext
 * requires on relative imports is stripped so Jest resolves the `.ts` source.
 */
export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: { parser: { syntax: 'typescript', importAttributes: true }, target: 'es2023' },
        module: { type: 'commonjs' },
      },
    ],
  },
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
};
