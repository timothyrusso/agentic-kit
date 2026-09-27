import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../createRule.js';
import { matchesAny, relativePath } from '../paths.js';

type Options = [{ allow?: string[] }];

const RELATIVE = /^\.\.?(?:\/|$)/;

/**
 * Imports go through the path alias (`@/features/...`), never `./` or `../`, so a file can move
 * without rewriting its imports. `allow` lists folders or files, as globs relative to the ESLint
 * working directory, where relative imports are fine.
 */
export const noRelativeImports = createRule<Options, 'relative'>({
  name: 'no-relative-imports',
  meta: {
    type: 'problem',
    docs: { description: 'Forbids `./` and `../` imports outside an allowlist of folders.' },
    schema: [
      {
        type: 'object',
        properties: { allow: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    messages: {
      relative: 'Import {{source}} through the path alias, not a relative path.',
    },
  },
  defaultOptions: [{ allow: [] }],
  create(context, [options]) {
    const allow = options.allow ?? [];
    if (allow.length > 0 && matchesAny(relativePath(context.cwd, context.filename), allow)) return {};

    function check(source: TSESTree.Node | null | undefined): void {
      if (source?.type !== AST_NODE_TYPES.Literal || typeof source.value !== 'string') return;
      if (RELATIVE.test(source.value)) {
        context.report({ node: source, messageId: 'relative', data: { source: source.value } });
      }
    }

    return {
      ImportDeclaration: node => check(node.source),
      ExportNamedDeclaration: node => check(node.source),
      ExportAllDeclaration: node => check(node.source),
      ImportExpression: node => check(node.source),
      TSImportType: node => check(node.source),
      CallExpression(node) {
        if (node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'require') check(node.arguments[0]);
      },
    };
  },
});
