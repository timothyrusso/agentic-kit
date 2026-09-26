import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../createRule.js';
import { isTestFile } from '../paths.js';

const ALLOWED = new Set(['state', 'derived', 'effects']);
const SHAPE = '{ state, derived?, effects }';

const NESTED_FUNCTION_TYPES = new Set<string>([
  AST_NODE_TYPES.FunctionDeclaration,
  AST_NODE_TYPES.FunctionExpression,
  AST_NODE_TYPES.ArrowFunctionExpression,
]);

type HookFunction = TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | TSESTree.FunctionDeclaration;

/**
 * Peels `x as const`, `x satisfies T` and `x!` off a value: the TypeScript parser nests the object
 * literal under `.expression`, and without this `return { state } as const` reads as a non-object.
 */
function unwrapTs(node: TSESTree.Expression): TSESTree.Expression {
  let current = node;
  while (
    current.type === AST_NODE_TYPES.TSAsExpression ||
    current.type === AST_NODE_TYPES.TSSatisfiesExpression ||
    current.type === AST_NODE_TYPES.TSNonNullExpression
  ) {
    current = current.expression;
  }
  return current;
}

/** A hook is any function whose name starts with `use` and an uppercase letter. */
function isHookName(name: string): boolean {
  return /^use[A-Z]/.test(name);
}

function isNode(value: unknown): value is TSESTree.Node {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

/**
 * The return statements that belong to the hook itself. Nested function bodies are skipped: their
 * returns belong to those functions (a `useEffect` cleanup, a callback), not to the hook.
 */
function collectOwnReturns(body: TSESTree.BlockStatement): TSESTree.ReturnStatement[] {
  const returns: TSESTree.ReturnStatement[] = [];

  function walk(node: TSESTree.Node): void {
    if (node.type === AST_NODE_TYPES.ReturnStatement) returns.push(node);
    for (const [key, value] of Object.entries(node)) {
      if (key === 'parent') continue;
      const children: unknown[] = Array.isArray(value) ? value : [value];
      for (const child of children) {
        if (!isNode(child) || NESTED_FUNCTION_TYPES.has(child.type)) continue;
        walk(child);
      }
    }
  }

  walk(body);
  return returns;
}

function keysOf(object: TSESTree.ObjectExpression): string[] {
  const keys: string[] = [];
  for (const property of object.properties) {
    if (property.type !== AST_NODE_TYPES.Property || property.computed) continue;
    if (property.key.type === AST_NODE_TYPES.Identifier) keys.push(property.key.name);
    else if (property.key.type === AST_NODE_TYPES.Literal) keys.push(String(property.key.value));
  }
  return keys;
}

/** A ViewModel (`*.logic.ts`) hook returns `{ state, derived?, effects }` or nothing. */
export const viewmodelReturnShape = createRule({
  name: 'viewmodel-return-shape',
  meta: {
    type: 'problem',
    docs: {
      description:
        'A ViewModel (*.logic.ts) hook must return an object literal whose keys are a non-empty subset of { state, derived, effects }, or return nothing.',
    },
    schema: [],
    messages: {
      notObject:
        "ViewModel hook '{{name}}' must return an object literal shaped as {{shape}} (or nothing). Found a non-object return.",
      wrongShape:
        "ViewModel hook '{{name}}' must return only a non-empty subset of {{shape}}. Disallowed keys: {{bad}}.",
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;
    if (!filename.endsWith('.logic.ts') || isTestFile(filename)) return {};

    function validateObject(reportNode: TSESTree.Node, hookName: string, object: TSESTree.ObjectExpression): void {
      const keys = keysOf(object);
      const bad = keys.filter(key => !ALLOWED.has(key));
      // NOTE: a spread could inject any key and a computed key is not statically known, so a
      // ViewModel return uses plain literal keys only.
      const hasSpread = object.properties.some(p => p.type === AST_NODE_TYPES.SpreadElement);
      const hasComputed = object.properties.some(p => p.type === AST_NODE_TYPES.Property && p.computed);
      if (bad.length > 0 || hasSpread || hasComputed) {
        const markers = [...bad];
        if (hasSpread) markers.push('(spread)');
        if (hasComputed) markers.push('(computed key)');
        context.report({
          node: reportNode,
          messageId: 'wrongShape',
          data: { name: hookName, shape: SHAPE, bad: markers.join(', ') },
        });
      } else if (keys.length === 0) {
        context.report({
          node: reportNode,
          messageId: 'wrongShape',
          data: { name: hookName, shape: SHAPE, bad: '(empty object)' },
        });
      }
    }

    function checkHook(hookName: string, fn: HookFunction): void {
      const body = fn.body;
      if (body.type !== AST_NODE_TYPES.BlockStatement) {
        const value = unwrapTs(body);
        if (value.type === AST_NODE_TYPES.ObjectExpression) validateObject(value, hookName, value);
        else context.report({ node: fn, messageId: 'notObject', data: { name: hookName, shape: SHAPE } });
        return;
      }
      for (const ret of collectOwnReturns(body)) {
        if (!ret.argument) continue;
        const value = unwrapTs(ret.argument);
        if (value.type !== AST_NODE_TYPES.ObjectExpression) {
          context.report({ node: ret, messageId: 'notObject', data: { name: hookName, shape: SHAPE } });
        } else {
          validateObject(ret, hookName, value);
        }
      }
    }

    return {
      VariableDeclarator(node) {
        if (node.id.type !== AST_NODE_TYPES.Identifier || !node.init || !isHookName(node.id.name)) return;
        if (
          node.init.type === AST_NODE_TYPES.ArrowFunctionExpression ||
          node.init.type === AST_NODE_TYPES.FunctionExpression
        ) {
          checkHook(node.id.name, node.init);
        }
      },
      FunctionDeclaration(node) {
        if (node.id && isHookName(node.id.name)) checkHook(node.id.name, node);
      },
    };
  },
});
