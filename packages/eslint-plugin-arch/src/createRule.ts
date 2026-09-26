import { ESLintUtils } from '@typescript-eslint/utils';

/** Every rule links to its section of the package README. */
export const createRule = ESLintUtils.RuleCreator(
  name => `https://github.com/timothyrusso/agentic-kit/tree/main/packages/eslint-plugin-arch#${name}`,
);
