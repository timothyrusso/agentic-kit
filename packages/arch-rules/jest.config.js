import base from '../../jest.config.base.js';

/**
 * dependency-cruiser ships ESM only, so this package runs Jest in ESM mode (the test script sets
 * `--experimental-vm-modules`) and SWC keeps `import` statements instead of emitting CommonJS.
 */
export default {
  ...base,
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: { parser: { syntax: 'typescript', importAttributes: true }, target: 'es2023' },
        module: { type: 'es6' },
      },
    ],
  },
};
