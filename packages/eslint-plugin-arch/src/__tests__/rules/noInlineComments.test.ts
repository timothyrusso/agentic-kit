import { noInlineComments } from '../../rules/noInlineComments.js';
import { ruleTester } from '../ruleTester.js';

const rule = noInlineComments;

ruleTester.run('no-inline-comments', rule, {
  valid: [
    { code: '/** Brief. */\nconst a = 1;' },
    { code: '/** Brief. */\nexport function a() {}' },
    { code: '/** Brief. */\nexport type A = string;' },
    { code: '/** Brief. */\n@injectable()\nexport class A {}' },
    { code: 'class A {\n  /** Brief. */\n  run(): void {}\n  /** Brief. */\n  value = 1;\n}' },
    { code: 'interface A {\n  /** Brief. */\n  run(): void;\n  /** Brief. */\n  value: string;\n}' },
    { code: 'type A = {\n  /** Brief. */\n  value: string;\n};' },
    {
      code: 'interface A {\n  /** Brief. */\n  (x: number): string;\n  /** Brief. */\n  new (x: number): A;\n}',
    },
    { code: '// NOTE: the array order is load-bearing.\nconst a = 1;' },
    { code: 'const a = () => {\n  // HACK: poll because the SDK never resolves on web.\n  return 1;\n};' },
    { code: '// biome-ignore lint/style/noNonNullAssertion: checked above\nconst a = 1;' },
    { code: '// eslint-disable-next-line no-console\nconst a = 1;' },
    { code: '/* eslint-disable no-console */\nconst a = 1;' },
    { code: '// @ts-expect-error untyped module\nconst a = 1;' },
    { code: '// @ts-ignore untyped module\nconst a = 1;' },
    { code: '/// <reference types="expo/types" />\nconst a = 1;' },
    {
      code: '// NOTE: the web build forwards unknown props onto the DOM node,\n// so they must sit on the wrapper.\nconst a = 1;',
    },
  ],
  invalid: [
    { code: '// Define button states\nconst a = 1;', errors: [{ messageId: 'noComment' }] },
    { code: 'const a = 1; // set to one', errors: [{ messageId: 'noComment' }] },
    { code: '/* Define button states */\nconst a = 1;', errors: [{ messageId: 'noComment' }] },
    {
      code: 'const A = () => <View>{/* spacer */}</View>;',
      errors: [{ messageId: 'noComment' }],
    },
    {
      code: 'function a() {\n  /** Define button states */\n  return 1;\n}',
      errors: [{ messageId: 'misplacedDoc' }],
    },
    { code: '/** Brief. */\nsetLoading(true);', errors: [{ messageId: 'misplacedDoc' }] },
    { code: '// TODO: wire this up\nconst a = 1;', errors: [{ messageId: 'noComment' }] },
    { code: '// FIXME: broken on web\nconst a = 1;', errors: [{ messageId: 'noComment' }] },
    { code: '// XXX: careful\nconst a = 1;', errors: [{ messageId: 'noComment' }] },
    { code: '// note: lowercase\nconst a = 1;', errors: [{ messageId: 'noComment' }] },
    { code: '// NOTE without a colon\nconst a = 1;', errors: [{ messageId: 'noComment' }] },
    {
      code: 'const a = () => {\n  // NOTE: wrapped.\n    // stray line\n  return 1;\n};',
      errors: [{ messageId: 'noComment' }],
    },
    {
      code: '// NOTE: a\n// TODO: b\nconst a = 1;',
      errors: [{ messageId: 'noComment', line: 2 }],
    },
    {
      code: '// HACK: a because b\n// FIXME: c\nconst a = 1;',
      errors: [{ messageId: 'noComment', line: 2 }],
    },
    {
      code: '// grouping label\n/** Brief. */\nexport const a = 1;',
      errors: [{ messageId: 'noComment' }],
    },
  ],
});

ruleTester.run('no-inline-comments (kit cases)', rule, {
  valid: [
    { name: 'TSDoc on an exported default function', code: '/** Brief. */\nexport default function a() {}' },
    { name: 'TSDoc on an exported interface', code: '/** Brief. */\nexport interface B {}' },
    { name: 'TSDoc on export default of a value', code: '/** @type {Config} */\nexport default { a: 1 };' },
    {
      name: 'TSDoc on a re-export list',
      code: "/** Public API. */\nexport { a } from './a.js';\nexport * from './b.js';",
    },
    { name: 'a file overview above the first import', code: "/** The module. */\nimport a from 'a';\nconst b = a;" },
    { name: 'a shebang and a file overview', code: "#!/usr/bin/env node\n/** A script. */\nimport a from 'a';" },
  ],
  invalid: [
    {
      name: 'a TSDoc block above a later import',
      code: "import a from 'a';\n/** Stray. */\nimport b from 'b';",
      errors: [{ messageId: 'misplacedDoc', line: 2 }],
    },
    {
      name: 'a codetag wrapped at a different column stops being the codetag',
      code: '// HACK: first\n  // second\nconst a = 1;',
      errors: [{ messageId: 'noComment', line: 2 }],
    },
  ],
});
