/**
 * dependency-cruiser for the kit's own packages, run by `npm run check:deps`. Apps get their
 * architecture rules from `@timothyrusso/arch-rules`; this config only keeps the packages tidy.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
export default {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Circular dependencies make code hard to reason about and test',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      comment: 'A module nothing imports is dead code, unless it is an entry point, a test or a config file',
      severity: 'error',
      from: {
        orphan: true,
        pathNot: ['(^|/)src/index\\.ts$', '(^|/)__tests__/', '(^|/)[^/]+\\.config\\.[cm]?js$', '\\.d\\.ts$'],
      },
      to: {},
    },
    {
      name: 'not-to-unresolvable',
      comment: 'Every import resolves to a file or an installed package',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-non-package-json',
      comment: 'Every package a package imports is declared in its own package.json',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'not-to-dev-dep',
      comment:
        'Published sources import runtime values only from dependencies and peerDependencies, never from a devDependency alone',
      severity: 'error',
      from: { path: '^packages/[^/]+/src/', pathNot: '(^|/)__tests__/' },
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only', 'npm-peer'] },
    },
    {
      name: 'not-to-test',
      comment: 'Published sources never import test code',
      severity: 'error',
      from: { pathNot: '(^|/)__tests__/' },
      to: { path: '(^|/)__tests__/' },
    },
    {
      name: 'no-cross-package-relative',
      comment: 'A package reaches another package through its npm name, never a relative path',
      severity: 'error',
      from: { path: '^packages/([^/]+)/' },
      to: { path: '^packages/', pathNot: '^packages/$1/' },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules'] },
    exclude: {
      path: ['^packages/[^/]+/(dist|coverage)/', '^packages/[^/]+/src/__tests__/fixtures/app/'],
    },
    tsPreCompilationDeps: true,
    combinedDependencies: false,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
