import { noRelativeImports } from '../../rules/noRelativeImports.js';
import { ruleTester } from '../ruleTester.js';

const rule = noRelativeImports;
/** RuleTester lints an absolute filename with the filesystem root as the working directory. */
const at = (path: string) => `/${path}`;

ruleTester.run('no-relative-imports', rule, {
  valid: [
    { name: 'an alias import', filename: at('features/a/ui/A.tsx'), code: "import { x } from '@/features/b';" },
    { name: 'a package import', filename: at('features/a/ui/A.tsx'), code: "import { View } from 'react-native';" },
    {
      name: 'a folder on the allowlist',
      filename: at('packages/tool/src/index.ts'),
      code: "export { a } from './a.js';\nimport { b } from '../b.js';",
      options: [{ allow: ['packages/*/src'] }],
    },
    {
      name: 'a file on the allowlist, globbed',
      filename: at('scripts/build/run.js'),
      code: "import { a } from './a.js';",
      options: [{ allow: ['scripts/**/*.js'] }],
    },
    { name: 'a dot-prefixed package name', filename: at('a.ts'), code: "import x from '.prettierrc';" },
  ],
  invalid: [
    {
      name: 'a sibling import',
      filename: at('features/a/ui/A.tsx'),
      code: "import { useALogic } from './A.logic';",
      errors: [{ messageId: 'relative', data: { source: './A.logic' } }],
    },
    {
      name: 'a parent import, re-exports, dynamic import, require and an import type',
      filename: at('features/a/index.ts'),
      code: [
        "import x from '..';",
        "export * from '../b';",
        "export { c } from './c';",
        "const d = import('./d');",
        "const e = require('./e');",
        "type F = import('./f').F;",
      ].join('\n'),
      errors: Array.from({ length: 6 }, () => ({ messageId: 'relative' as const })),
    },
    {
      name: 'outside the allowlist',
      filename: at('packages/tool/jest.config.js'),
      code: "import base from '../../jest.config.base.js';",
      options: [{ allow: ['packages/*/src'] }],
      errors: [{ messageId: 'relative' }],
    },
  ],
});
