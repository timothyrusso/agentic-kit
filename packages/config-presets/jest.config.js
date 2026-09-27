import base from '../../jest.config.base.js';

/**
 * commitlint and jiti ship ESM, so this package runs Jest in ESM mode (the test script sets
 * `--experimental-vm-modules`) and SWC keeps `import` statements instead of emitting CommonJS.
 */
export default {
  ...base,
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', importAttributes: true },
          target: 'es2023',
          experimental: { keepImportAttributes: true },
        },
        module: { type: 'es6' },
      },
    ],
  },
};
