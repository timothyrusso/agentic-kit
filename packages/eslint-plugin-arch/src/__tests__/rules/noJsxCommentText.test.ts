import { noJsxCommentText } from '../../rules/noJsxCommentText.js';
import { ruleTester } from '../ruleTester.js';

ruleTester.run('no-jsx-comment-text', noJsxCommentText, {
  valid: [
    { name: 'a comment in an expression container', code: 'const A = () => <View>{/* spacer */}</View>;' },
    { name: 'a URL in text is not at the start', code: 'const A = () => <Text>See https://example.com</Text>;' },
    { name: 'a comment outside JSX', code: '// NOTE: fine\nconst A = () => <View />;' },
  ],
  invalid: [
    {
      name: 'a line comment written as a child',
      code: 'const A = () => (\n  <View>\n    // the eyebrow is gone\n    <Text>x</Text>\n  </View>\n);',
      errors: [{ messageId: 'commentText', line: 2 }],
    },
    {
      name: 'a block comment written as a child',
      code: 'const A = () => <View>/* spacer */</View>;',
      errors: [{ messageId: 'commentText' }],
    },
  ],
});
