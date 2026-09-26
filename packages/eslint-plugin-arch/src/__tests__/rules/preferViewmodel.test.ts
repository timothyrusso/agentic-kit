import { preferViewmodel } from '../../rules/preferViewmodel.js';
import { ruleTester } from '../ruleTester.js';

const rule = preferViewmodel;
const TSX = 'SelectDatesPage.tsx';
const IMPORT = "import { useSelectDatesPageLogic } from '@/features/x/SelectDatesPage.logic';";

ruleTester.run('prefer-viewmodel', rule, {
  valid: [
    {
      name: 'calls only its own ViewModel hook, once',
      filename: TSX,
      code: `${IMPORT}
        export const SelectDatesPage = () => {
          const { state } = useSelectDatesPageLogic();
          return null;
        };`,
    },
    {
      name: 'no .logic import: presentational component, exempt even if it calls hooks',
      filename: TSX,
      code: `import { useState } from 'react';
        export const Dumb = () => { const [x] = useState(0); return null; };`,
    },
    {
      name: 'test files are exempt even if they mix hooks freely',
      filename: 'SelectDatesPage.test.tsx',
      code: `${IMPORT}
        import { useState } from 'react';
        export const SelectDatesPage = () => { const [x] = useState(0); return null; };`,
    },
    {
      name: 'the .logic import is hoisted below the component',
      filename: TSX,
      code: `export const SelectDatesPage = () => {
          const { state } = useSelectDatesPageLogic();
          return null;
        };
        ${IMPORT}`,
    },
    {
      name: 'allowlisted foreign hook is permitted',
      filename: TSX,
      code: `${IMPORT}
        import { useGlassmorphism } from '@/features/core/design-system';
        export const SelectDatesPage = () => {
          const { state } = useSelectDatesPageLogic();
          const cls = useGlassmorphism();
          return null;
        };`,
      options: [{ allow: ['useGlassmorphism'] }],
    },
  ],
  invalid: [
    {
      name: 'calls a foreign hook alongside its ViewModel',
      filename: TSX,
      code: `${IMPORT}
        import { useState } from 'react';
        export const SelectDatesPage = () => {
          const { state } = useSelectDatesPageLogic();
          const [x] = useState(0);
          return null;
        };`,
      errors: [{ messageId: 'foreignHook' }],
    },
    {
      name: 'a namespace-qualified foreign hook (React.useState) does not bypass the rule',
      filename: TSX,
      code: `${IMPORT}
        import * as React from 'react';
        export const SelectDatesPage = () => {
          const { state } = useSelectDatesPageLogic();
          const [x] = React.useState(0);
          return null;
        };`,
      errors: [{ messageId: 'foreignHook' }],
    },
    {
      name: 'a member call named like the ViewModel import is a different binding, so foreign',
      filename: TSX,
      code: `${IMPORT}
        import * as hooks from '@/hooks';
        export const SelectDatesPage = () => {
          const { state } = useSelectDatesPageLogic();
          hooks.useSelectDatesPageLogic();
          return null;
        };`,
      errors: [{ messageId: 'foreignHook' }],
    },
    {
      name: 'calls its ViewModel hook twice',
      filename: TSX,
      code: `${IMPORT}
        export const SelectDatesPage = () => {
          const a = useSelectDatesPageLogic();
          const b = useSelectDatesPageLogic();
          return null;
        };`,
      errors: [{ messageId: 'calledTwice' }],
    },
    {
      name: "another view's ViewModel is foreign",
      filename: TSX,
      code: `${IMPORT}
        import { useSelectGuestsPageLogic } from '@/features/x/SelectGuestsPage.logic';
        export const SelectDatesPage = () => {
          const { state } = useSelectDatesPageLogic();
          const { state: guests } = useSelectGuestsPageLogic();
          return null;
        };`,
      errors: [{ messageId: 'foreignHook' }],
    },
    {
      name: 'foreign ViewModel call plus the own hook called twice: both reported',
      filename: TSX,
      code: `${IMPORT}
        import { useSelectGuestsPageLogic } from '@/features/x/SelectGuestsPage.logic';
        export const SelectDatesPage = () => {
          const a = useSelectDatesPageLogic();
          const { state: guests } = useSelectGuestsPageLogic();
          const b = useSelectDatesPageLogic();
          return null;
        };`,
      errors: [{ messageId: 'foreignHook' }, { messageId: 'calledTwice' }],
    },
    {
      name: 'foreign hook not covered by the allowlist',
      filename: TSX,
      code: `${IMPORT}
        import { useGlassmorphism } from '@/features/core/design-system';
        export const SelectDatesPage = () => {
          const { state } = useSelectDatesPageLogic();
          const cls = useGlassmorphism();
          return null;
        };`,
      errors: [{ messageId: 'foreignHook' }],
    },
  ],
});

ruleTester.run('prefer-viewmodel (kit cases)', rule, {
  valid: [
    {
      name: 'a default-imported ViewModel hook',
      filename: '/app/features/x/ui/Card.tsx',
      code: `import useCardLogic from './Card.logic';
        export const Card = () => { const vm = useCardLogic(); return null; };`,
    },
    {
      name: 'a .ts file is not a view',
      filename: 'SelectDatesPage.ts',
      code: `${IMPORT}
        import { useState } from 'react';
        export const f = () => { useSelectDatesPageLogic(); useState(0); };`,
    },
  ],
  invalid: [
    {
      name: 'the message names the expected and the found hook',
      filename: TSX,
      code: `${IMPORT}
        import { useTheme } from '@/features/core/design-system';
        export const SelectDatesPage = () => { useSelectDatesPageLogic(); useTheme(); return null; };`,
      options: [{ allow: ['useOther'] }],
      errors: [{ messageId: 'foreignHook', data: { expected: 'useSelectDatesPageLogic', found: 'useTheme' } }],
    },
  ],
});
