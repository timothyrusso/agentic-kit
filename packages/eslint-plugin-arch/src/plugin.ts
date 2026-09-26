import type { ESLint } from 'eslint';
import { rules } from './rules/index.js';

/**
 * The plugin object, without `configs`: the recommended config registers this same instance.
 *
 * NOTE: the rules are typed with `@typescript-eslint/utils`, whose `RuleContext` declares members
 * ESLint's own `Rule` type leaves out, so the two types do not unify. They are the same objects at
 * runtime; the cast is the one place the plugin crosses from one type to the other.
 */
export const plugin: ESLint.Plugin = {
  meta: { name: '@timothyrusso/eslint-plugin-arch' },
  rules: rules as unknown as NonNullable<ESLint.Plugin['rules']>,
};
