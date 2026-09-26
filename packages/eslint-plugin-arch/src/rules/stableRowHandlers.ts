import { AST_NODE_TYPES, ASTUtils, TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../createRule.js';

const { DefinitionType } = TSESLint.Scope;

const LISTS = new Set(['FlashList', 'FlatList']);

type FunctionNode = TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression | TSESTree.FunctionDeclaration;

function isFunction(node: TSESTree.Node | null | undefined): node is FunctionNode {
  return (
    node?.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node?.type === AST_NODE_TYPES.FunctionExpression ||
    node?.type === AST_NODE_TYPES.FunctionDeclaration
  );
}

/** `name(...)` or `X.name(...)`. */
function isCallTo(node: TSESTree.Node | null | undefined, name: string): node is TSESTree.CallExpression {
  if (node?.type !== AST_NODE_TYPES.CallExpression) return false;
  const callee = node.callee;
  if (callee.type === AST_NODE_TYPES.Identifier) return callee.name === name;
  return (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    callee.property.type === AST_NODE_TYPES.Identifier &&
    callee.property.name === name
  );
}

function elementName(name: TSESTree.JSXTagNameExpression): string {
  if (name.type === AST_NODE_TYPES.JSXIdentifier) return name.name;
  if (name.type === AST_NODE_TYPES.JSXMemberExpression) return `${elementName(name.object)}.${name.property.name}`;
  return `${name.namespace.name}:${name.name.name}`;
}

function lastSegment(name: string): string {
  return name.slice(name.lastIndexOf('.') + 1);
}

function isNode(value: unknown): value is TSESTree.Node {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

/**
 * The outermost elements a render function returns: the first JSX element on every path, looking
 * through fragments. Elements nested inside a row are the row's own business. The nodes are
 * collected, not their names, so a host element such as `View` elsewhere in the file is untouched.
 */
function rowElementsIn(root: TSESTree.Node, out: Set<TSESTree.JSXOpeningElement>): void {
  if (root.type === AST_NODE_TYPES.JSXElement) {
    if (/^[A-Z]/.test(lastSegment(elementName(root.openingElement.name)))) out.add(root.openingElement);
    return;
  }
  if (isFunction(root)) return;
  for (const [key, value] of Object.entries(root)) {
    if (key === 'parent') continue;
    const children: unknown[] = Array.isArray(value) ? value : [value];
    for (const child of children) if (isNode(child)) rowElementsIn(child, out);
  }
}

/** The function a `renderItem` value names: inline, wrapped in `useCallback`, or a local binding. */
function renderFunction(scope: TSESLint.Scope.Scope, value: TSESTree.Expression): FunctionNode | undefined {
  if (isFunction(value)) return value;
  if (isCallTo(value, 'useCallback')) {
    const first = value.arguments[0];
    return isFunction(first) ? first : undefined;
  }
  if (value.type !== AST_NODE_TYPES.Identifier) return undefined;
  const def = ASTUtils.findVariable(scope, value.name)?.defs[0];
  if (def?.type === DefinitionType.FunctionName)
    return def.node.type === AST_NODE_TYPES.FunctionDeclaration ? def.node : undefined;
  if (def?.type === DefinitionType.Variable && def.node.init) return renderFunction(scope, def.node.init);
  return undefined;
}

interface Usage {
  readonly element: TSESTree.JSXOpeningElement;
  readonly scope: TSESLint.Scope.Scope;
}

/**
 * In a file that renders a `FlashList` or `FlatList`, every function passed to a row component (one
 * rendered by `renderItem`) or to a `memo` component is a `useCallback` result or a module-level
 * function. An inline arrow is a new prop on every render and defeats the row's `memo`.
 */
export const stableRowHandlers = createRule({
  name: 'stable-row-handlers',
  meta: {
    type: 'problem',
    docs: {
      description:
        'In a list file, functions passed to row and memo components are useCallback results or module-level functions, never inline.',
    },
    schema: [],
    messages: {
      inline:
        '{{prop}} on {{component}} is created on every render. Pass a useCallback result or a module-level function that takes the id.',
      unstable:
        '{{prop}} on {{component}} is {{name}}, a function recreated on every render. Wrap it in useCallback or move it to module level.',
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    const usages: Usage[] = [];
    const lists: Usage[] = [];
    const memoComponents = new Set<string>();

    function checkAttribute(attribute: TSESTree.JSXAttribute, component: string, scope: TSESLint.Scope.Scope): void {
      if (attribute.value?.type !== AST_NODE_TYPES.JSXExpressionContainer) return;
      const value = attribute.value.expression;
      if (value.type === AST_NODE_TYPES.JSXEmptyExpression) return;
      const prop = elementName(attribute.name);
      if (isFunction(value) || isCallTo(value, 'bind')) {
        context.report({ node: value, messageId: 'inline', data: { prop, component } });
        return;
      }
      if (value.type !== AST_NODE_TYPES.Identifier) return;
      const variable = ASTUtils.findVariable(scope, value.name);
      const def = variable?.defs[0];
      if (!variable || !def || variable.scope.type === 'module' || variable.scope.type === 'global') return;
      const unstable =
        (def.type === DefinitionType.FunctionName && isFunction(def.node)) ||
        (def.type === DefinitionType.Variable && isFunction(def.node.init));
      if (unstable) {
        context.report({ node: value, messageId: 'unstable', data: { prop, component, name: value.name } });
      }
    }

    return {
      VariableDeclarator(node) {
        if (node.id.type === AST_NODE_TYPES.Identifier && isCallTo(node.init, 'memo')) memoComponents.add(node.id.name);
      },
      JSXOpeningElement(node) {
        const usage = { element: node, scope: sourceCode.getScope(node) };
        if (LISTS.has(lastSegment(elementName(node.name)))) lists.push(usage);
        usages.push(usage);
      },
      'Program:exit'() {
        if (lists.length === 0) return;
        const rows = new Set<TSESTree.JSXOpeningElement>();
        for (const { element, scope } of lists) {
          for (const attribute of element.attributes) {
            if (attribute.type !== AST_NODE_TYPES.JSXAttribute || attribute.name.name !== 'renderItem') continue;
            if (attribute.value?.type !== AST_NODE_TYPES.JSXExpressionContainer) continue;
            const expression = attribute.value.expression;
            if (expression.type === AST_NODE_TYPES.JSXEmptyExpression) continue;
            const render = renderFunction(scope, expression);
            if (render) rowElementsIn(render.body, rows);
          }
        }
        for (const { element, scope } of usages) {
          const component = elementName(element.name);
          if (!rows.has(element) && !memoComponents.has(component)) continue;
          for (const attribute of element.attributes) {
            if (attribute.type === AST_NODE_TYPES.JSXAttribute) checkAttribute(attribute, component, scope);
          }
        }
      },
    };
  },
});
