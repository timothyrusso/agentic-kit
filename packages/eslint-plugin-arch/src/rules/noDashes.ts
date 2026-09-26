import type { TSESTree } from '@typescript-eslint/utils';
import { createRule } from '../createRule.js';

/**
 * NOTE: built from code points, so this file passes its own rule and a repo-wide text replace
 * cannot rewrite the characters the rule depends on.
 */
const EM = String.fromCodePoint(0x2014);
const EN = String.fromCodePoint(0x2013);

/**
 * No em dash anywhere in a file, and no en dash in prose: string literals, template text, JSX
 * text and comments. A numeric range takes a plain hyphen (`8-12`).
 */
export const noDashes = createRule({
  name: 'no-dashes',
  meta: {
    type: 'problem',
    docs: {
      description: 'Forbids the em dash (U+2014) anywhere and the en dash (U+2013) in strings, JSX text and comments.',
    },
    schema: [],
    messages: {
      emDash: 'No em dash. Use a colon, a comma, parentheses or a middle dot.',
      enDash: 'No en dash in prose. Use a hyphen, also for a numeric range such as 8-12.',
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    const text = sourceCode.getText();
    if (!text.includes(EM) && !text.includes(EN)) return {};

    function reportEach(start: number, end: number, ch: string, messageId: 'emDash' | 'enDash'): void {
      let at = text.indexOf(ch, start);
      while (at !== -1 && at < end) {
        context.report({
          loc: { start: sourceCode.getLocFromIndex(at), end: sourceCode.getLocFromIndex(at + 1) },
          messageId,
        });
        at = text.indexOf(ch, at + 1);
      }
    }

    function checkProse(node: TSESTree.Node | TSESTree.Comment): void {
      reportEach(node.range[0], node.range[1], EN, 'enDash');
    }

    return {
      Program() {
        reportEach(0, text.length, EM, 'emDash');
        for (const comment of sourceCode.getAllComments()) checkProse(comment);
      },
      Literal(node) {
        if (typeof node.value === 'string') checkProse(node);
      },
      TemplateElement: checkProse,
      JSXText: checkProse,
    };
  },
});
