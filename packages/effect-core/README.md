# @timothyrusso/effect-core

The shared Effect layer an app builds on: the error model, the Logger and Config services, the
one app runtime, the SQLite interface and migration runner, the React boundary hooks and the
jest helpers.

```sh
npm install @timothyrusso/effect-core effect @tanstack/react-query
```

Peer dependencies: `effect` 3.x, and for `/react` also `react` and `@tanstack/react-query` v5.
The package has no native dependency: the app passes in `expo-constants` and `expo-sqlite`.

## Entry points

| Import | Contents |
| --- | --- |
| `@timothyrusso/effect-core` | Errors, Logger, Config, runtime, SQLite (safe for Metro) |
| `@timothyrusso/effect-core/react` | `EffectRuntimeProvider`, `useEffectQuery`, `useEffectMutation`, `useErrorMessage` |
| `@timothyrusso/effect-core/testing` | Jest helpers; loads `node:sqlite`, so import it only from tests |

### `@timothyrusso/effect-core`

| Export | What it is |
| --- | --- |
| `AppErrorBase(tag, messageKey)` | Declares a `Data.TaggedError` class with a `messageKey` and an optional `cause` |
| `UnexpectedError` | The error every defect becomes; `cause: unknown` |
| `toAppError(cause, isKnown?)` | For the `catch` of `Effect.tryPromise`: wraps unknown values in `UnexpectedError` |
| `isAppError(value)` | Shape check: a string `_tag` and `messageKey` |
| `defineAppErrors<AppError>()` | Binds the closed union; `.assertExhaustiveMessageKeys(mapper)` fails to compile on a missing or unknown tag |
| `resolveMessageKey(error, mapper)` | The key the mapper gives an error |
| `Logger`, `ConsoleLogger`, `NoopLogger` | The logging Tag (`error(error, context)`, `warn`, `info`, `debug`) and two Layers |
| `Clock` | Effect's clock, re-exported |
| `makeConfig(schema)`, `ConfigError` | A `Config` Tag and a Live Layer decoding the app's `extra`; boot fails naming the field |
| `makeAppRuntime(layer)`, `AppServicesOf` | The one `ManagedRuntime`: `boot`, `runPromise`, `runPromiseExit`, `runFork`, `dispose` |
| `SqliteClient`, `SqliteDatabase`, `SqlError` | The connection Tag, shaped on expo-sqlite's async API, and its error |
| `withSqlite(operation, query)`, `trySql` | Run a query as an Effect failing with `SqlError` |
| `runMigrations(client, migrations)` | `{ version, up }` steps keyed by `PRAGMA user_version`, each in its own transaction |

### `@timothyrusso/effect-core/react`

| Export | What it is |
| --- | --- |
| `EffectRuntimeProvider` | Puts the app runtime in context, inside `QueryClientProvider` |
| `useEffectQuery(options)` | `useQuery` with `queryFn` an `Effect<A, AppError, AppServices>`; interrupts on unmount or key change |
| `useEffectMutation(options)` | `useMutation` with `mutationFn` returning an Effect; `onError` gets an `AppError` |
| `useErrorMessage(error, mapper, t)` | The translated message for an error |
| `Register` | The interface the app augments with its services and error union |

A defect becomes an `UnexpectedError` with the defect as `cause`; each failure is logged once
through `Logger` (`error` for an `UnexpectedError`, `warn` with the tag otherwise).

### `@timothyrusso/effect-core/testing`

| Export | What it is |
| --- | --- |
| `itEffect(name, effect, layer?)`, `runTest(effect, layer?)` | Run an Effect as a jest test, with `TestContext` |
| `makeNodeSqliteLayer()`, `makeNodeSqliteDatabase()` | `SqliteClient` over an in-memory `node:sqlite` database |
| `collectLogs()` | A `Logger` Layer recording into `entries` |
| `advanceClock(duration)`, `TestClock`, `TestContext` | Move time in tests |

## Wiring an app

```ts
// features/core/config
import Constants from 'expo-constants';
export const AppConfig = makeConfig(Schema.Struct({ apiUrl: Schema.String }));
export const ConfigLive = AppConfig.layer(() => Constants.expoConfig?.extra);

// features/core/runtime
export const runtime = makeAppRuntime(Layer.mergeAll(ConsoleLogger, ConfigLive, SqliteLive));
export type AppServices = AppServicesOf<typeof runtime>;

declare module '@timothyrusso/effect-core/react' {
  interface Register {
    services: AppServices;
    error: AppError;
  }
}
```

Render `<EffectRuntimeProvider runtime={runtime}>` inside the `QueryClientProvider`. Once
`Register` is filled in, a facade passing an Effect that needs a service the runtime does not
provide, or that fails with an error outside `AppError`, does not compile.

The expo-sqlite Live Layer is one line in the app:

```ts
export const SqliteLive = Layer.effect(SqliteClient, Effect.promise(() => SQLite.openDatabaseAsync('app.db')));
```
