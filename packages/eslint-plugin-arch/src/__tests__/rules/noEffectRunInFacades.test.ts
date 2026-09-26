import { noEffectRunInFacades } from '../../rules/noEffectRunInFacades.js';
import { ruleTester } from '../ruleTester.js';

const FACADE = '/app/features/items/facades/useItems.ts';

ruleTester.run('no-effect-run-in-facades', noEffectRunInFacades, {
  valid: [
    {
      name: 'a facade handing the Effect to useEffectQuery',
      filename: FACADE,
      code: "import { useEffectQuery } from '@timothyrusso/effect-core/react';\nexport const useItems = () => useEffectQuery(['items'], getItems());",
    },
    {
      name: 'a use case may run an Effect',
      filename: '/app/features/items/useCases/getItems.ts',
      code: 'Effect.runPromise(program);',
    },
    { name: 'a method that only starts with run', filename: FACADE, code: 'job.runner();' },
  ],
  invalid: [
    {
      name: 'Effect.runPromise in a facade',
      filename: FACADE,
      code: 'Effect.runPromise(program);',
      errors: [{ messageId: 'run', data: { name: 'runPromise' } }],
    },
    {
      name: 'a runtime run method in a facade',
      filename: FACADE,
      code: 'runtime.runSyncExit(program);',
      errors: [{ messageId: 'run', data: { name: 'runSyncExit' } }],
    },
    {
      name: 'ManagedRuntime in a facade',
      filename: FACADE,
      code: "import { ManagedRuntime } from 'effect';\nimport * as MR from 'effect/ManagedRuntime';",
      errors: [
        { messageId: 'runtime', line: 1 },
        { messageId: 'runtime', line: 2 },
      ],
    },
  ],
});
