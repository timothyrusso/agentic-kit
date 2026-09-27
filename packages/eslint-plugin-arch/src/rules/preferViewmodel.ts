import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../createRule.js';
import { isTestFile } from '../paths.js';

type Options = [{ allow?: string[] }];

interface HookCall {
  readonly node: TSESTree.CallExpression;
  readonly name: string;
  readonly isMember: boolean;
}

function isHookCall(name: string): boolean {
  return /^use[A-Z]/.test(name);
}

function basename(path: string, suffix: RegExp): string {
  return path.slice(path.lastIndexOf('/') + 1).replace(suffix, '');
}

/**
 * A `.tsx` backed by a ViewModel (it imports its sibling `.logic` module) calls only its own
 * ViewModel hook, at most once. `allow` names hooks a view may still call directly.
 */
export const preferViewmodel = createRule<Options, 'foreignHook' | 'calledTwice'>({
  name: 'prefer-viewmodel',
  meta: {
    type: 'problem',
    docs: {
      description:
        'A .tsx backed by a ViewModel (a `.logic` import) may call only its own ViewModel hook, at most once, and no other hooks.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      foreignHook:
        'A ViewModel-backed component may only call its own ViewModel hook ({{expected}}). Move this call ({{found}}) into the ViewModel.',
      calledTwice: 'The ViewModel hook {{expected}} must be called at most once.',
    },
  },
  defaultOptions: [{ allow: [] }],
  create(context, [options]) {
    const filename = context.filename.split('\\').join('/');
    if (!filename.endsWith('.tsx') || isTestFile(filename)) return {};

    // NOTE: a view's own ViewModel is the sibling `.logic` module with the same basename
    // (SelectDatesPage.tsx and SelectDatesPage.logic). A hook from any other `.logic` module is
    // another view's ViewModel, and therefore foreign.
    const fileBase = basename(filename, /\.tsx$/);
    const allow = new Set(options.allow ?? []);
    const viewModelHooks = new Set<string>();
    // NOTE: classification waits for Program:exit, once every import is known, so a call that
    // appears before its hoisted `.logic` import is not misread as foreign.
    const allCalls: HookCall[] = [];

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (!/\.logic$/.test(source) || basename(source, /\.logic$/) !== fileBase) return;
        for (const spec of node.specifiers) {
          if (spec.type === AST_NODE_TYPES.ImportSpecifier || spec.type === AST_NODE_TYPES.ImportDefaultSpecifier) {
            viewModelHooks.add(spec.local.name);
          }
        }
      },
      CallExpression(node) {
        const isMember = node.callee.type === AST_NODE_TYPES.MemberExpression;
        const callee = node.callee.type === AST_NODE_TYPES.MemberExpression ? node.callee.property : node.callee;
        if (callee.type !== AST_NODE_TYPES.Identifier || !isHookCall(callee.name)) return;
        allCalls.push({ node, name: callee.name, isMember });
      },
      'Program:exit'() {
        if (viewModelHooks.size === 0) return;
        const expected = [...viewModelHooks].join(' | ');
        const perHook = new Map<string, number>();
        const secondCalls: HookCall[] = [];

        for (const call of allCalls) {
          // NOTE: the ViewModel hook is an imported binding called as a bare identifier. A member
          // call (`X.useY()`) is a different binding, so it is always foreign.
          if (!call.isMember && viewModelHooks.has(call.name)) {
            const count = (perHook.get(call.name) ?? 0) + 1;
            perHook.set(call.name, count);
            if (count > 1) secondCalls.push(call);
          } else if (!allow.has(call.name)) {
            context.report({ node: call.node, messageId: 'foreignHook', data: { expected, found: call.name } });
          }
        }

        for (const call of secondCalls) {
          context.report({ node: call.node, messageId: 'calledTwice', data: { expected: call.name } });
        }
      },
    };
  },
});
