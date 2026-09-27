import { Context, Effect, Exit, Fiber, Layer } from 'effect';
import { type AppServicesOf, makeAppRuntime } from '../makeAppRuntime.js';

class Greeter extends Context.Tag('acme/Greeter')<Greeter, { readonly greet: (name: string) => string }>() {}
class Payments extends Context.Tag('acme/Payments')<Payments, { readonly charge: () => Effect.Effect<void> }>() {}

const greet = (name: string) => Effect.map(Greeter, greeter => greeter.greet(name));
const chargeAndGreet = Effect.zipRight(
  Effect.flatMap(Payments, payments => payments.charge()),
  greet('acme'),
);

describe('makeAppRuntime', () => {
  const released: string[] = [];
  const GreeterLive = Layer.scoped(
    Greeter,
    Effect.acquireRelease(Effect.succeed({ greet: (name: string) => `hi ${name}` }), () =>
      Effect.sync(() => void released.push('greeter')),
    ),
  );

  it('runs Effects needing the Layer services, as a promise, an exit or a fiber', async () => {
    const runtime = makeAppRuntime(GreeterLive);
    await runtime.boot();
    await expect(runtime.runPromise(greet('ada'))).resolves.toBe('hi ada');
    expect(await runtime.runPromiseExit(greet('bob'))).toEqual(Exit.succeed('hi bob'));
    await expect(Effect.runPromise(Fiber.join(runtime.runFork(greet('cy'))))).resolves.toBe('hi cy');
    await runtime.dispose();
    expect(released).toEqual(['greeter']);
  });

  it('interrupts the fiber when the signal aborts', async () => {
    const runtime = makeAppRuntime(GreeterLive);
    const controller = new AbortController();
    const running = runtime.runPromiseExit(Effect.never, { signal: controller.signal });
    controller.abort();
    const exit = await running;
    expect(Exit.isInterrupted(exit)).toBe(true);
    await runtime.dispose();
  });

  it('makes an Effect needing a service outside the runtime a compile error', async () => {
    const runtime = makeAppRuntime(GreeterLive);
    type Services = AppServicesOf<typeof runtime>;
    const exact: [Services] extends [Greeter] ? ([Greeter] extends [Services] ? true : false) : false = true;
    expect(exact).toBe(true);
    // @ts-expect-error Payments is not provided by the runtime
    const missing = runtime.runPromiseExit(chargeAndGreet);
    expect(Exit.isFailure(await missing)).toBe(true);
    // @ts-expect-error Payments is not provided by the runtime
    runtime.runFork(chargeAndGreet);
    await runtime.dispose();
  });
});
