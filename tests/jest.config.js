/**
 * Jest for the plugin's scripts and workflow, which are plain ESM JavaScript with no build step:
 * no transform, run with `--experimental-vm-modules` (see the `test:plugin` script).
 */
export default {
  rootDir: '..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/plugin/**/*.test.mjs'],
  moduleFileExtensions: ['js', 'mjs', 'json'],
  transform: {},
};
