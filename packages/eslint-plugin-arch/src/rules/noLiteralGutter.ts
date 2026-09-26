import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../createRule.js';
import { matchesAny, relativePath } from '../paths.js';

type Options = [
  {
    gutterToken: string;
    spacingImport: string;
    allowlistFile?: string;
    nonGutterTokens?: string[];
  },
];

/** Horizontal style properties, and the layout-primitive props that spell the same thing. */
const STYLE_PROPS = new Set([
  'paddingHorizontal',
  'paddingLeft',
  'paddingRight',
  'paddingStart',
  'paddingEnd',
  'marginHorizontal',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginEnd',
]);
const SHORTHAND_PROPS = new Set(['px', 'mx', 'pl', 'pr', 'ml', 'mr']);

/** The spacing step that kept standing in for the gutter. */
const DEFAULT_NON_GUTTER_TOKENS = ['xl'];

const allowlists = new Map<string, readonly string[]>();

/**
 * Reads an allowlist file once per process: one path or glob per line, relative to the ESLint
 * working directory, with `#` starting a comment.
 */
function readAllowlist(cwd: string, file: string): readonly string[] {
  const path = resolve(cwd, file);
  const cached = allowlists.get(path);
  if (cached) return cached;
  const entries = existsSync(path)
    ? readFileSync(path, 'utf8')
        .split('\n')
        .map(line => line.replace(/#.*/, '').trim())
        .filter(Boolean)
    : [];
  allowlists.set(path, entries);
  return entries;
}

function propName(key: TSESTree.Node): string | undefined {
  if (key.type === AST_NODE_TYPES.Identifier) return key.name;
  if (key.type === AST_NODE_TYPES.Literal && typeof key.value === 'string') return key.value;
  return undefined;
}

function isNonZeroNumber(node: TSESTree.Node): boolean {
  if (node.type === AST_NODE_TYPES.UnaryExpression && node.operator === '-') return isNonZeroNumber(node.argument);
  return node.type === AST_NODE_TYPES.Literal && typeof node.value === 'number' && node.value !== 0;
}

function rootIdentifier(node: TSESTree.Node): string | undefined {
  if (node.type === AST_NODE_TYPES.Identifier) return node.name;
  if (node.type === AST_NODE_TYPES.MemberExpression) return rootIdentifier(node.object);
  return undefined;
}

/**
 * One horizontal edge, owned in one place: a horizontal padding or margin is never a literal number
 * (0 is a reset, not a measurement) and never the spacing step that stood in for the gutter.
 */
export const noLiteralGutter = createRule<Options, 'literal' | 'token'>({
  name: 'no-literal-gutter',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbids literal numbers and the non-gutter spacing token in horizontal padding and margin style properties.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          gutterToken: { type: 'string', minLength: 1 },
          spacingImport: { type: 'string', minLength: 1 },
          allowlistFile: { type: 'string', minLength: 1 },
          nonGutterTokens: { type: 'array', items: { type: 'string', minLength: 1 } },
        },
        required: ['gutterToken', 'spacingImport'],
        additionalProperties: false,
      },
    ],
    messages: {
      literal:
        '{{prop}} is a literal. Use {{gutter}} for a screen edge or a spacing step from {{spacing}} inside a component.',
      token: '{{prop}} uses {{value}}, which is not the gutter. Use {{gutter}} for a screen edge or a smaller step.',
    },
  },
  defaultOptions: [{ gutterToken: 'screenGutter', spacingImport: '@/theme/tokens' }],
  create(context, [options]) {
    if (options.allowlistFile) {
      const allow = readAllowlist(context.cwd, options.allowlistFile);
      if (allow.length > 0 && matchesAny(relativePath(context.cwd, context.filename), allow)) return {};
    }

    const nonGutter = new Set(options.nonGutterTokens ?? DEFAULT_NON_GUTTER_TOKENS);
    const spacingLocals = new Set<string>();
    const data = (prop: string, value = '') => ({
      prop,
      value,
      gutter: options.gutterToken,
      spacing: options.spacingImport,
    });

    function isNonGutterToken(node: TSESTree.Node): boolean {
      if (node.type !== AST_NODE_TYPES.MemberExpression || node.computed) return false;
      if (node.property.type !== AST_NODE_TYPES.Identifier || !nonGutter.has(node.property.name)) return false;
      const root = rootIdentifier(node.object);
      return root !== undefined && spacingLocals.has(root);
    }

    function checkValue(prop: string, value: TSESTree.Node): void {
      if (isNonZeroNumber(value)) {
        context.report({ node: value, messageId: 'literal', data: data(prop) });
      } else if (isNonGutterToken(value)) {
        context.report({ node: value, messageId: 'token', data: data(prop, context.sourceCode.getText(value)) });
      }
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value !== options.spacingImport) return;
        for (const spec of node.specifiers) spacingLocals.add(spec.local.name);
      },
      Property(node) {
        const name = propName(node.key);
        if (name === undefined || !STYLE_PROPS.has(name)) return;
        checkValue(name, node.value);
      },
      JSXAttribute(node) {
        if (node.name.type !== AST_NODE_TYPES.JSXIdentifier) return;
        const name = node.name.name;
        if (!STYLE_PROPS.has(name) && !SHORTHAND_PROPS.has(name)) return;
        const value = node.value;
        if (!value) return;
        const inner =
          value.type === AST_NODE_TYPES.JSXExpressionContainer &&
          value.expression.type !== AST_NODE_TYPES.JSXEmptyExpression
            ? value.expression
            : value;
        if (inner.type === AST_NODE_TYPES.Literal && typeof inner.value === 'string' && nonGutter.has(inner.value)) {
          context.report({ node: inner, messageId: 'token', data: data(name, `'${inner.value}'`) });
          return;
        }
        checkValue(name, inner);
      },
    };
  },
});
