import base from '../../jest.config.base.js';

/**
 * The React hook tests run in jsdom (each opts in with a `@jest-environment jsdom` docblock); the
 * setup file gives jsdom the `TextEncoder` and `TextDecoder` Effect needs.
 */
export default {
  ...base,
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
};
