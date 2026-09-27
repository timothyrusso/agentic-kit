import { viewmodelReturnShape } from '../../rules/viewmodelReturnShape.js';
import { ruleTester } from '../ruleTester.js';

const rule = viewmodelReturnShape;
const LOGIC = 'SelectDatesPage.logic.ts';

ruleTester.run('viewmodel-return-shape', rule, {
  valid: [
    {
      name: 'full three-bucket contract',
      filename: LOGIC,
      code: `export const useSelectDatesPageLogic = () => {
          return { state: { a: 1 }, derived: { b: 2 }, effects: { c: () => {} } };
        };`,
    },
    {
      name: 'non-empty subset (state + effects, no derived)',
      filename: LOGIC,
      code: `export const useXLogic = () => { return { state: { a: 1 }, effects: { c: () => {} } }; };`,
    },
    {
      name: 'non-empty subset (derived only): any single allowed bucket is valid',
      filename: LOGIC,
      code: `export const useXLogic = () => ({ derived: { b: 2 } });`,
    },
    {
      name: 'FunctionDeclaration form of a ViewModel hook',
      filename: LOGIC,
      code: `export function useSelectDatesPageLogic() { return { state: {}, effects: {} }; }`,
    },
    {
      name: 'non-hook function in a .logic file is ignored',
      filename: LOGIC,
      code: `export function helper() { return { anything: 1 }; }`,
    },
    {
      name: 'implicit-return arrow object',
      filename: LOGIC,
      code: `export const useXLogic = () => ({ effects: { c: () => {} } });`,
    },
    {
      name: 'void / effect-only ViewModel (no return)',
      filename: LOGIC,
      code: `export const useSignInPageLogic = () => { const x = 1; };`,
    },
    {
      name: 'bare guard return + a valid object return',
      filename: LOGIC,
      code: `export const useXLogic = () => { if (Math.random()) return; return { state: { a: 1 } }; };`,
    },
    {
      name: 'a return inside a nested function belongs to that function',
      filename: LOGIC,
      code: `export const useXLogic = () => {
          const cleanup = () => { return { notAllowed: 1 }; };
          return { effects: { cleanup } };
        };`,
    },
    {
      name: 'TS wrapper on a block return',
      filename: LOGIC,
      code: `export const useXLogic = () => { return { state: {} } as const; };`,
    },
    {
      name: 'TS wrapper on an implicit-return arrow',
      filename: LOGIC,
      code: `export const useXLogic = () => ({ effects: {} }) as const;`,
    },
    {
      name: 'not a .logic.ts file: rule does not apply',
      filename: 'helper.ts',
      code: `export const useXLogic = () => { return { anything: 1 }; };`,
    },
  ],
  invalid: [
    {
      name: 'flat grab-bag',
      filename: LOGIC,
      code: `export const useSelectDatesPageLogic = () => {
          return { startDate: 1, handleButtonPress: () => {}, numberOfDays: 2 };
        };`,
      errors: [{ messageId: 'wrongShape' }],
    },
    {
      name: 'a single disallowed key mixed with allowed ones',
      filename: LOGIC,
      code: `export const useXLogic = () => { return { state: {}, loading: true }; };`,
      errors: [{ messageId: 'wrongShape' }],
    },
    {
      name: 'empty object return',
      filename: LOGIC,
      code: `export const useXLogic = () => { return {}; };`,
      errors: [{ messageId: 'wrongShape' }],
    },
    {
      name: 'a spread is rejected even alongside a valid bucket',
      filename: LOGIC,
      code: `export const useXLogic = () => { return { state: {}, ...extra }; };`,
      errors: [{ messageId: 'wrongShape' }],
    },
    {
      name: 'a computed key is rejected',
      filename: LOGIC,
      code: `export const useXLogic = () => { return { state: {}, [dynamic]: 1 }; };`,
      errors: [{ messageId: 'wrongShape' }],
    },
    {
      name: 'non-conforming return nested in control flow',
      filename: LOGIC,
      code: `export const useXLogic = () => {
          if (Math.random()) {
            return { foo: 1 };
          }
          return { state: {} };
        };`,
      errors: [{ messageId: 'wrongShape' }],
    },
    {
      name: 'returns a non-object',
      filename: LOGIC,
      code: `export const useXLogic = () => { return 42; };`,
      errors: [{ messageId: 'notObject' }],
    },
    {
      name: 'name-agnostic: hook without the Logic suffix is still checked',
      filename: 'TripDetailsCard.logic.ts',
      code: `export const useTripDetailsCard = () => { return { dateLabel: 'x' }; };`,
      errors: [{ messageId: 'wrongShape' }],
    },
  ],
});

ruleTester.run('viewmodel-return-shape (kit cases)', rule, {
  valid: [
    {
      name: 'test files are skipped',
      filename: 'SelectDatesPage.logic.test.ts',
      code: `export const useXLogic = () => ({ anything: 1 });`,
    },
    {
      name: 'satisfies wrapper',
      filename: LOGIC,
      code: `export const useXLogic = () => ({ state: {} }) satisfies object;`,
    },
  ],
  invalid: [
    {
      name: 'implicit-return arrow returning a ternary',
      filename: LOGIC,
      code: `export const useXLogic = () => (a ? { state: {} } : null);`,
      errors: [{ messageId: 'notObject' }],
    },
    {
      name: 'function expression hook',
      filename: LOGIC,
      code: `export const useXLogic = function () { return { other: 1 }; };`,
      errors: [
        { messageId: 'wrongShape', data: { name: 'useXLogic', shape: '{ state, derived?, effects }', bad: 'other' } },
      ],
    },
  ],
});
