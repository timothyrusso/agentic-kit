import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { createRule } from '../createRule.js';

const RUN_METHOD = /^run(?:Promise|Sync|Fork|Callback)(?:Exit)?$/;

/**
 * A facade runs an Effect only through `useEffectQuery` or `useEffectMutation`: no `Effect.run*`,
 * no `runtime.runPromise`, no `ManagedRuntime`. The dependency-cruiser rule
 * `facades-run-through-boundary` sees modules, not the names imported from them; this sees names.
 */
export const noEffectRunInFacades = createRule({
  name: 'no-effect-run-in-facades',
  meta: {
    type: 'problem',
    docs: { description: 'Forbids `*.run*` calls and `ManagedRuntime` in files under `facades/`.' },
    schema: [],
    messages: {
      run: 'A facade does not call {{name}}. Hand the Effect to useEffectQuery or useEffectMutation.',
      runtime: 'A facade does not touch ManagedRuntime. The app runtime is built once, in core/runtime.',
    },
  },
  defaultOptions: [],
  create(context) {
    if (!context.filename.split('\\').join('/').includes('/facades/')) return {};
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.property.type !== AST_NODE_TYPES.Identifier) {
          return;
        }
        if (RUN_METHOD.test(callee.property.name)) {
          context.report({ node: callee, messageId: 'run', data: { name: callee.property.name } });
        }
      },
      ImportDeclaration(node) {
        if (/^effect\/ManagedRuntime$/.test(node.source.value)) {
          context.report({ node: node.source, messageId: 'runtime' });
          return;
        }
        for (const spec of node.specifiers) {
          if (
            spec.type === AST_NODE_TYPES.ImportSpecifier &&
            spec.imported.type === AST_NODE_TYPES.Identifier &&
            spec.imported.name === 'ManagedRuntime'
          ) {
            context.report({ node: spec, messageId: 'runtime' });
          }
        }
      },
    };
  },
});
