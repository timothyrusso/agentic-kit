import { createRule } from '../createRule.js';

/**
 * Inside JSX, `//` is not a comment: it is text, which type-checks clean and then crashes React
 * Native with "Text strings must be rendered within a <Text> component". A comment inside a JSX
 * expression container is a real comment and passes.
 */
export const noJsxCommentText = createRule({
  name: 'no-jsx-comment-text',
  meta: {
    type: 'problem',
    docs: {
      description: 'Forbids comment-shaped JSX text (`// ...` or `/* ... */` written as a JSX child).',
    },
    schema: [],
    messages: {
      commentText:
        'This comment sits in a JSX text position and renders as literal text. Wrap it in {/* ... */} or lift it above the element.',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      JSXText(node) {
        const content = node.value.trim();
        if (content.startsWith('//') || content.startsWith('/*')) {
          context.report({ node, messageId: 'commentText' });
        }
      },
    };
  },
});
