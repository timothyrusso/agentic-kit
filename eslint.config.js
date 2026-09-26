import tseslint from 'typescript-eslint';

/**
 * ESLint covers only what Biome does not: `no-restricted-syntax` for the kit's own conventions.
 * The kit's ESLint plugin joins this config once `packages/eslint-plugin-arch` exists.
 */
export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] },
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: { parser: tseslint.parser, sourceType: 'module' },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message: 'Use a union of string literals or an `as const` object, not `enum`.',
        },
        {
          selector: "TSAsExpression > TSTypeReference.typeAnnotation > Identifier[name='Error']",
          message: 'Do not cast to Error: narrow with `instanceof` or convert with a helper.',
        },
      ],
    },
  },
];
