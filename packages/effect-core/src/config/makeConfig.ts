import { Context, Effect, Layer, ParseResult, Schema } from 'effect';
import { AppErrorBase } from '../errors/appError.js';

/**
 * The app configuration failed to decode at boot. `field` is the dotted path of the first bad
 * field (`api.baseUrl`); `message` lists every problem.
 */
export class ConfigError extends AppErrorBase('ConfigError', 'errors.config')<{
  readonly field: string;
  readonly message: string;
}> {}

/** The identifier of the app's config service in the runtime's context. */
export interface AppConfig {
  readonly _AppConfig: 'AppConfig';
}

/** What {@link makeConfig} returns. */
export interface ConfigDefinition<A> {
  /** The Tag use cases read the decoded config from: `const config = yield* Config.Config`. */
  readonly Config: Context.Tag<AppConfig, A>;
  /**
   * The Live Layer. `readExtra` is called once, when the runtime boots; its result is decoded
   * with the schema, and a missing or invalid field fails the boot with a {@link ConfigError}.
   * An `undefined` result counts as an empty object, so the error still names the field.
   */
  readonly layer: (readExtra: () => unknown) => Layer.Layer<AppConfig, ConfigError>;
  /** A Layer holding an already decoded value, for tests. */
  readonly layerOf: (config: A) => Layer.Layer<AppConfig>;
}

function describe(error: ParseResult.ParseError): ConfigError {
  const issues = ParseResult.ArrayFormatter.formatErrorSync(error);
  const field = issues[0]?.path.map(String).join('.') ?? '';
  const message = issues
    .map(issue => {
      const path = issue.path.map(String).join('.');
      return path === '' ? issue.message : `${path}: ${issue.message}`;
    })
    .join('; ');
  return new ConfigError({ field, message: `Invalid app config: ${message}`, cause: error });
}

/**
 * Declares the app's config from a Schema. The kit has no native dependency, so the app passes
 * where the values come from; in an Expo app that is the `extra` block of `app.config.ts`:
 *
 * @example
 * ```ts
 * import Constants from 'expo-constants';
 *
 * export const AppConfig = makeConfig(Schema.Struct({ apiUrl: Schema.String }));
 * export const ConfigLive = AppConfig.layer(() => Constants.expoConfig?.extra);
 * ```
 */
export function makeConfig<A, I>(schema: Schema.Schema<A, I, never>): ConfigDefinition<A> {
  const Config = Context.GenericTag<AppConfig, A>('@timothyrusso/effect-core/Config');
  const decode = Schema.decodeUnknown(schema, { errors: 'all' });
  return {
    Config,
    layer: readExtra =>
      Layer.effect(
        Config,
        Effect.try({
          try: () => readExtra() ?? {},
          catch: cause =>
            new ConfigError({ field: '', message: 'Invalid app config: reading the source threw', cause }),
        }).pipe(Effect.flatMap(extra => Effect.mapError(decode(extra), describe))),
      ),
    layerOf: config => Layer.succeed(Config, config),
  };
}
