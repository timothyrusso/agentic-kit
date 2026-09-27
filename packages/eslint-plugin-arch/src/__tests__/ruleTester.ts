import * as tsParser from '@typescript-eslint/parser';
import { RuleTester } from '@typescript-eslint/rule-tester';

/**
 * The parser setup the ported cases were written against: TypeScript, modules, JSX. Unused disable
 * directives are not reported, as in ESLint's own RuleTester, so a directive-only case stays valid.
 */
export const ruleTester = new RuleTester({
  linterOptions: { reportUnusedDisableDirectives: 'off' },
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

/** An em dash and an en dash, built from code points so no test file holds the characters. */
export const EM = String.fromCodePoint(0x2014);
export const EN = String.fromCodePoint(0x2013);
