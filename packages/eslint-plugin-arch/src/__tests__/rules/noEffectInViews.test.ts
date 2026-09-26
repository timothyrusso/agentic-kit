import { noEffectInViews } from '../../rules/noEffectInViews.js';
import { ruleTester } from '../ruleTester.js';

const rule = noEffectInViews;

ruleTester.run('no-effect-in-views', rule, {
  valid: [
    { name: 'a use case may import effect', filename: 'getItems.ts', code: "import { Effect } from 'effect';" },
    {
      name: 'a view importing the ViewModel',
      filename: 'ItemsPage.tsx',
      code: "import { useItemsPageLogic } from './ItemsPage.logic';",
    },
    {
      name: 'a package whose name starts with effect',
      filename: 'ItemsPage.tsx',
      code: "import x from 'effector';",
    },
  ],
  invalid: [
    {
      name: 'effect in a view',
      filename: 'ItemsPage.tsx',
      code: "import { Effect } from 'effect';",
      errors: [{ messageId: 'effectImport', data: { source: 'effect' } }],
    },
    {
      name: 'a type-only import is still an import',
      filename: 'ItemsPage.tsx',
      code: "import type { Effect } from 'effect/Effect';",
      errors: [{ messageId: 'effectImport' }],
    },
    {
      name: 'an @effect package, a re-export, a dynamic import and require',
      filename: 'ItemsPage.tsx',
      code: "import '@effect/platform';\nexport * from 'effect';\nconst m = import('effect');\nconst r = require('effect');",
      errors: [
        { messageId: 'effectImport' },
        { messageId: 'effectImport' },
        { messageId: 'effectImport' },
        { messageId: 'effectImport' },
      ],
    },
  ],
});
