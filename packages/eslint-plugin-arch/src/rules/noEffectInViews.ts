import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../createRule.js';

/** `effect`, a subpath of it, or an `@effect/*` package. */
const EFFECT_MODULE = /^(?:effect|@effect\/[^/]+)(?:\/|$)/;

/**
 * A `.tsx` never imports Effect. Views read a ViewModel; facades hand Effects to
 * `useEffectQuery` and `useEffectMutation`. The dependency-cruiser rule catches the same import
 * across the graph; this one puts the message on the line.
 */
export const noEffectInViews = createRule({
  name: 'no-effect-in-views',
  meta: {
    type: 'problem',
    docs: { description: 'Forbids importing `effect` or `@effect/*` in a `.tsx` file.' },
    schema: [],
    messages: {
      effectImport:
        'A view does not import {{source}}. Run the Effect in a use case and read the result through the ViewModel and a facade.',
    },
  },
  defaultOptions: [],
  create(context) {
    if (!context.filename.endsWith('.tsx')) return {};

    function check(source: TSESTree.Node | null | undefined): void {
      if (source?.type !== AST_NODE_TYPES.Literal || typeof source.value !== 'string') return;
      if (EFFECT_MODULE.test(source.value)) {
        context.report({ node: source, messageId: 'effectImport', data: { source: source.value } });
      }
    }

    return {
      ImportDeclaration: node => check(node.source),
      ExportNamedDeclaration: node => check(node.source),
      ExportAllDeclaration: node => check(node.source),
      ImportExpression: node => check(node.source),
      CallExpression(node) {
        if (node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'require') check(node.arguments[0]);
      },
    };
  },
});
