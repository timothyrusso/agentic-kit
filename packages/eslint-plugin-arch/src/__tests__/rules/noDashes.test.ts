import { noDashes } from '../../rules/noDashes.js';
import { EM, EN, ruleTester } from '../ruleTester.js';

ruleTester.run('no-dashes', noDashes, {
  valid: [
    { name: 'hyphens and a numeric range', code: "const reps = '8-12'; const a = 'well-known';" },
    { name: 'a middle dot separator', code: "const meta = 'Legs \\u00b7 45 min';" },
    { name: 'an en dash escape sequence is not the character', code: "const a = '\\u2013';" },
  ],
  invalid: [
    {
      name: 'em dash in a string',
      code: `const title = 'Legs ${EM} heavy';`,
      errors: [{ messageId: 'emDash', line: 1, column: 21 }],
    },
    {
      name: 'em dash in a comment',
      code: `// NOTE: one ${EM} two\nconst a = 1;`,
      errors: [{ messageId: 'emDash' }],
    },
    {
      name: 'em dash in an identifier-free template, reported once',
      code: `const a = \`x ${EM} y\`;`,
      errors: [{ messageId: 'emDash' }],
    },
    {
      name: 'every em dash is reported',
      code: `const a = '${EM}${EM}';`,
      errors: [
        { messageId: 'emDash', column: 12 },
        { messageId: 'emDash', column: 13 },
      ],
    },
    {
      name: 'en dash in a string',
      code: `const reps = '8${EN}12';`,
      errors: [{ messageId: 'enDash' }],
    },
    {
      name: 'en dash in template text',
      code: `const reps = \`\${a}${EN}\${b}\`;`,
      errors: [{ messageId: 'enDash' }],
    },
    {
      name: 'en dash in JSX text and a JSX attribute',
      code: `const A = () => <Text title="a${EN}b">Mon${EN}Fri</Text>;`,
      errors: [{ messageId: 'enDash' }, { messageId: 'enDash' }],
    },
    {
      name: 'en dash in a block comment',
      code: `/** Pages 1${EN}3. */\nconst a = 1;`,
      errors: [{ messageId: 'enDash' }],
    },
  ],
});
