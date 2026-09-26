import { Effect, Layer, Schema } from 'effect';
import { makeAppRuntime } from '../../runtime/makeAppRuntime.js';
import { ConfigError, makeConfig } from '../makeConfig.js';

const AcmeConfig = makeConfig(
  Schema.Struct({
    apiUrl: Schema.String,
    api: Schema.Struct({ timeoutMs: Schema.Number }),
    sentryDsn: Schema.optional(Schema.String),
  }),
);

const readApiUrl = Effect.map(AcmeConfig.Config, config => config.apiUrl);

describe('makeConfig', () => {
  it('decodes extra into the Config service', async () => {
    const runtime = makeAppRuntime(AcmeConfig.layer(() => ({ apiUrl: 'https://acme.test', api: { timeoutMs: 5000 } })));
    await expect(runtime.runPromise(readApiUrl)).resolves.toBe('https://acme.test');
    await runtime.dispose();
  });

  it('fails the boot with a ConfigError naming the missing field', async () => {
    const runtime = makeAppRuntime(AcmeConfig.layer(() => ({ api: { timeoutMs: 5000 } })));
    const failure = await runtime.boot().then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(ConfigError);
    expect(failure).toMatchObject({ _tag: 'ConfigError', field: 'apiUrl', messageKey: 'errors.config' });
    expect(String((failure as ConfigError).message)).toContain('apiUrl');
    await runtime.dispose();
  });

  it('names a nested field by its dotted path, and treats a missing extra as empty', async () => {
    const nested = await Effect.runPromise(
      Effect.flip(Layer.build(AcmeConfig.layer(() => ({ apiUrl: 'x', api: {} }))).pipe(Effect.scoped)),
    );
    expect(nested.field).toBe('api.timeoutMs');

    const empty = await Effect.runPromise(
      Effect.flip(Layer.build(AcmeConfig.layer(() => undefined)).pipe(Effect.scoped)),
    );
    expect(empty.field).toBe('apiUrl');
    expect(empty.message).toContain('api');
  });

  it('turns a throwing source into a ConfigError', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        Layer.build(
          AcmeConfig.layer(() => {
            throw new Error('no manifest');
          }),
        ).pipe(Effect.scoped),
      ),
    );
    expect(error).toBeInstanceOf(ConfigError);
  });

  it('provides a decoded value for tests', async () => {
    const layer = AcmeConfig.layerOf({ apiUrl: 'https://test', api: { timeoutMs: 1 } });
    await expect(Effect.runPromise(Effect.provide(readApiUrl, layer))).resolves.toBe('https://test');
  });
});
