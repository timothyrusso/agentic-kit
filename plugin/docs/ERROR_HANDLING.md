# Error handling

How failures are typed, raised, logged and shown in an app built on agentic-kit. Every layer has
one job. Read this before writing any code that can fail. The layer structure it refers to is in
[ARCHITECTURE.md](ARCHITECTURE.md); the Effect vocabulary is in [EFFECT_PRIMER.md](EFFECT_PRIMER.md).

## Philosophy

**Failures are in the type.** A function that can fail returns `Effect<A, E, R>`, and `E` names
every way it can fail. Callers cannot forget a failure, because tsc sees it.

**The union is closed.** Every `E` that reaches the UI is a member of the app's `AppError` union,
and the message mapper covers every member. Adding an error without a message is a compile error.

**Nothing throws across a layer.** Inside Effect code a failure is a value in `E`. A thrown
exception or a rejected promise that nobody anticipated is a defect; the runtime boundary turns
it into an `UnexpectedError`. The only deliberate throw is a facade raising a screen-level
failure to the route's `ErrorBoundary`.

**Log once, at the runtime boundary.** `useEffectQuery` and `useEffectMutation` log each
failure once, through the `Logger` service. Use cases, Layers, facades and ViewModels never log.

**The UI never reads `error.message`.** User-facing text comes from the catalog key the mapper
gives the error's tag, through `useErrorMessage`.

## `Effect<A, E, R>`

Read it as: "a program that, given the services `R`, succeeds with an `A` or fails with an `E`".
It replaces `Promise<Result<T>>`: there are no `ok()` and `fail()` helpers and no
`if (!result.success)` at every call site. `yield*` on an Effect that fails stops the
`Effect.gen` block and carries the failure out, with its type added to `E`.

```ts
export const renameItem = (id: ItemId, name: string) =>
  Effect.gen(function* () {
    const repo = yield* ItemRepository;
    const item = yield* repo.byId(id);
    if (item === undefined) return yield* new ItemNotFound({ itemId: id });
    yield* repo.save({ ...item, name });
  });
// Effect<void, SqlError | ItemNotFound, ItemRepository>
```

Two kinds of failure:

| Kind | What it is | How it is raised | What the boundary does |
| --- | --- | --- | --- |
| Failure (typed) | An expected outcome: not found, offline, invalid input, a storage error | `yield* new ItemNotFound(...)`, `Effect.fail`, a mapped `catch` | `Logger.warn` with the tag; `error` is the error itself |
| Defect | A bug or an unanticipated throw | `throw` inside `Effect.sync`, `Effect.die`, `Effect.orDie` | Becomes `UnexpectedError` with the defect as `cause`; `Logger.error` |

## Tagged errors and `AppErrorBase`

Every error class is a `Data.TaggedError` declared with `AppErrorBase(tag, messageKey)` from
`@timothyrusso/effect-core`. It carries a `_tag` (the class name), a `messageKey` into the app's
catalog, the fields you declare, and an optional `cause`. Instances are real `Error`s, compare
structurally, and are yieldable in `Effect.gen`.

```ts
// features/items/domain/errors/ItemNotFound.ts
import { AppErrorBase } from '@/features/core/error';

export class ItemNotFound extends AppErrorBase('ItemNotFound', 'errors.itemNotFound')<{
  readonly itemId: string;
}> {}
```

- One class per failure mode, in the feature's `domain/errors/`. The tag is the class name.
- `domain/` imports `AppErrorBase` from `@/features/core/error`, which re-exports it:
  `domain-pure-except-effect` forbids every `node_modules` package in `domain/` except `effect`,
  the kit included, and `core/error` is the one feature public API `domain/` may import
  (`domain-no-cross-feature-runtime-import` exception).
- Fields are for logs and for logic that discriminates (`error.itemId`). The UI never renders
  them raw.
- Pass `cause` when wrapping a lower-level error, so the report keeps the chain.
- Create a new class when the UI or a caller must treat the failure differently, or when a
  distinct name makes logs actionable. A one-off that no one handles specially can be an
  `UnexpectedError` via `toAppError`.

The kit ships four errors an app includes in its union: `UnexpectedError` (every defect),
`SqlError` (a statement or transaction failed), `ConfigError` (the app config failed to decode
at boot, naming the field) and whatever the app declares in its core concerns (`HttpError`,
`OfflineError`, `ParseError`).

## The closed `AppError` union

`features/core/error` owns `AppError`. Since `core/error` is Tier 0 it cannot import a feature
(`no-tier-violation-features-core-error` would fail), so features register their errors instead:
`core/error` declares a registry interface, and each feature adds its errors to it by module
augmentation, which is a downward import.

```ts
// features/core/error/domain/appError.ts
import type { ConfigError, SqlError, UnexpectedError } from '@timothyrusso/effect-core';

/** Each feature adds `<feature>: <its error union>` here from its domain/errors. */
export interface AppErrorRegistry {
  core: UnexpectedError | SqlError | ConfigError;
}

/** The closed union of every error that can reach the UI. */
export type AppError = AppErrorRegistry[keyof AppErrorRegistry];
```

```ts
// features/items/domain/errors/index.ts
import type { ItemNameTaken } from '@/features/items/domain/errors/ItemNameTaken';
import type { ItemNotFound } from '@/features/items/domain/errors/ItemNotFound';

declare module '@/features/core/error' {
  interface AppErrorRegistry {
    items: ItemNotFound | ItemNameTaken;
  }
}
```

The union is still closed: it is exactly the set of augmentations in the program, fixed at
compile time. The message mapper, next to it in `core/error`, must name every tag:

```ts
// features/core/error/mappers/errorTagToMessageKey.ts
const appErrors = defineAppErrors<AppError>();

export const errorTagToMessageKey = appErrors.assertExhaustiveMessageKeys({
  UnexpectedError: 'errors.unexpected',
  SqlError: 'errors.storage',
  ConfigError: 'errors.config',
  ItemNotFound: 'errors.itemNotFound',
  ItemNameTaken: 'errors.itemNameTaken',
});
```

A tag missing from the object, or a key that is not a tag, fails to compile. The keys are plain
strings, so `core/error` imports nothing from any feature. Keep each key equal to the class's
own `messageKey`; the reviewer checks it.

`core/runtime` registers the union with the hooks (see
[ARCHITECTURE.md](ARCHITECTURE.md#services-layers-and-the-runtime)):

```ts
declare module '@timothyrusso/effect-core/react' {
  interface Register {
    services: AppServices;
    error: AppError;
  }
}
```

From then on `useEffectQuery` and `useEffectMutation` accept only `Effect<A, AppError,
AppServices>`, and their `error` is typed `AppError`.

## `toAppError`

`toAppError(cause, isKnown?)` turns an unknown thrown value into an app error. It is the `catch`
of `Effect.tryPromise` and `Effect.try` when there is no more specific error to raise. An
`UnexpectedError` passes through; with `isKnown`, the app's own errors pass through too;
anything else becomes `new UnexpectedError({ cause })`.

```ts
Effect.tryPromise({ try: () => api.item(id), catch: toAppError });
Effect.tryPromise({ try: () => sdk.save(item), catch: cause => toAppError(cause, isItemsError) });
```

Never cast: `error as Error` is forbidden by `no-restricted-syntax`. Narrow with `instanceof`
or wrap with `toAppError`.

When the failure is known, raise the specific error instead:
`catch: cause => new OfflineError({ cause })`. `trySql` and `withSqlite` do this for SQLite,
failing with `SqlError`.

## Layer by layer

| Layer | Role in a failure | Logs? |
| --- | --- | --- |
| `data/` | Wraps every driver, SDK and network call (`trySql`, `Effect.tryPromise`) and fails with a tagged error; decodes untrusted input with Schema and maps the parse error to a tagged one | Never |
| `useCases/` | Raises domain failures (`yield* new ItemNotFound(...)`), recovers from the ones it can (`Effect.catchTag`), lets the rest flow out in `E` | Never |
| `di/` | Builds Layers; a Layer that cannot build fails the boot | Never |
| runtime boundary (`useEffectQuery`, `useEffectMutation`) | Turns defects into `UnexpectedError`, logs each failure once, hands `error` to TanStack Query | Once |
| `facades/` | Chooses the surface: toast, inline state, or a throw to the route boundary | Never |
| `.logic.ts` | Maps `error` to view state with `useErrorMessage`; no `try/catch` | Never |
| `.tsx` | Renders the error state the ViewModel returns | Never |

### `data/`

```ts
export const ItemRepositoryLive = Layer.effect(
  ItemRepository,
  Effect.gen(function* () {
    const db = yield* SqliteClient;
    return {
      byId: id =>
        trySql('item by id', () => db.getFirstAsync<ItemRow>('SELECT * FROM items WHERE id = ?', [id])).pipe(
          Effect.flatMap(row => (row === null ? Effect.succeed(undefined) : decodeItem(row))),
        ),
      ...
    };
  }),
);
```

- Never let a promise rejection escape unmapped: every call is `trySql`, `withSqlite` or
  `Effect.tryPromise` with a `catch`.
- A parse failure of untrusted data is a typed error (`ParseError` in the app's core, or a
  feature error), not a defect: the data is wrong, not the code.
- Never swallow: a `catchAll` that returns a default hides a failure the user should see. If a
  fallback is right, it is a use case decision, named and tested.

### `useCases/`

- Raise with `yield* new SomeError({...})`; it ends the block and adds the type to `E`.
- Recover with `Effect.catchTag('ItemNotFound', () => ...)` when the use case genuinely has an
  answer for it; the tag leaves `E`.
- Retry and time out here, where the policy is a business decision:
  `Effect.retry(Schedule.exponential('200 millis').pipe(Schedule.compose(Schedule.recurs(3))))`,
  `Effect.timeoutFail({ duration: '10 seconds', onTimeout: () => new OfflineError() })`.
- Never log, and never convert a typed failure into a defect with `Effect.orDie`.

### `facades/`

The facade runs the use case through a hook and decides how a failure surfaces. It never logs
(the boundary did), never catches, and never imports `effect` (`effect-only-in-inner-layers`),
the runtime (`facades-run-through-boundary`) or a `run*` method (`arch/no-effect-run-in-facades`).

```ts
export const useRenameItem = (id: ItemId) => {
  const { showErrorToast } = useToast();
  return useEffectMutation({
    mutationFn: (name: string) => renameItem(id, name),
    onError: showErrorToast,
  });
};
```

For a screen-level failure the facade may throw `query.error` during render, so the route's
`ErrorBoundary` takes over. Do it only when the screen has nothing useful to show without the
data.

### `.logic.ts`

```ts
export const useItemPageLogic = (id: ItemId) => {
  const item = useItem(id);
  const errorMessage = useAppErrorMessage(item.error);
  return {
    state: { item: item.data, isLoading: item.isPending },
    derived: { errorMessage },
    effects: { retry: item.refetch },
  };
};
```

No `try/catch`, no logging, no `error.message`.

### `.tsx`

Renders `derived.errorMessage` and the retry action. Never touches an error object.

## Logging at the runtime boundary

The `Logger` service (`@timothyrusso/effect-core`) has `error(error, context)`, `warn`, `info`
and `debug`, each an Effect that never fails. The boundary logs every failure once:

- an `UnexpectedError` (every defect) through `Logger.error(error, { queryKey })` or
  `{ mutationKey }`;
- a typed failure through `Logger.warn(tag, { queryKey, error })`.

Which Layer backs `Logger` is the runtime's choice: `ConsoleLogger` in development, the app's
own Layer in release builds (a Sentry Layer sends `error` calls), `NoopLogger` or `collectLogs()`
in tests. Nothing else writes to the console: Biome's `noConsole` rule is on in the kit's preset.

### TanStack Query retries log once per attempt

TanStack Query retries a failed query three times by default, and each attempt runs the Effect
again through the boundary, so one failure is logged four times. Keep retries inside the Effect
(`Effect.retry` with a `Schedule`, in the use case or the Layer), where they happen before the
boundary and the final failure is logged once, and switch TanStack's own retry off for errors
from the Effect hooks. Every error those hooks report is an app error (a typed failure or an
`UnexpectedError`), so the query client's default is:

```ts
// features/core/query/queryClient.ts
import { isAppError } from '@timothyrusso/effect-core';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: (failureCount, error) => !isAppError(error) && failureCount < 3 },
  },
});
```

Plain `useQuery` calls that do not go through Effect keep TanStack's retry. Mutations do not
retry by default.

## Boot failures

`makeAppRuntime` builds the app Layer lazily, on the first run. A Layer that fails to build (a
`ConfigError` naming the missing field, a database that does not open, a failed migration) then
fails every query with no log from the hooks: the boundary logs through `Logger`, and `Logger` is
part of the Layer that failed.

So the app builds the runtime once at startup with `await runtime.boot()`, which rejects with the
Layer's error, and handles the failure there: report it with the crash reporter directly (or the
console in development) and render the fatal screen.

```tsx
// app/_layout.tsx
export default function RootLayout() {
  const [bootError, setBootError] = useState<unknown>(null);
  useEffect(() => {
    runtime.boot().catch(error => {
      reportBootFailure(error);
      setBootError(error);
    });
  }, []);
  if (bootError !== null) return <FatalScreen error={bootError} />;
  return (
    <QueryClientProvider client={queryClient}>
      <EffectRuntimeProvider runtime={runtime}>
        <Stack />
      </EffectRuntimeProvider>
    </QueryClientProvider>
  );
}
```

`reportBootFailure` and `FatalScreen` are the app's own (`core/error` and the design system). A
`.tsx` without a `.logic` import is exempt from `arch/prefer-viewmodel`, which is why the root
layout may hold this state.

## SQLite and migrations

`runMigrations(db, migrations)` brings the database to the highest version, keyed by
`PRAGMA user_version`, each step in its own exclusive transaction with the version bump, so a
failing step rolls back and leaves `user_version` at the last step that succeeded. It fails with
`SqlError`; a duplicate or non-integer version is a defect. Two SQLite facts matter:

- **On expo-sqlite, an exclusive transaction runs on a fresh connection.** Pragmas set on the
  app's connection when it opened (`PRAGMA foreign_keys = ON`, `journal_mode`, `busy_timeout`)
  do not apply inside a migration step. Foreign keys are therefore off during migrations: a
  cascade does not fire and a dangling reference is not rejected. Run
  `PRAGMA foreign_key_check` at the end of a step that touches references, and fail the step if
  it returns rows.
- **SQLite ignores `PRAGMA foreign_keys` inside a transaction.** A step cannot switch foreign keys
  on or off for itself. This is what makes the table-rebuild recipe (create the new table, copy,
  drop, rename) safe on the migration connection, and it also means a step that wants the check
  must run `foreign_key_check` itself.

Tests run migrations on `makeNodeSqliteLayer()` from `@timothyrusso/effect-core/testing`, an
in-memory `node:sqlite` database: an empty database reaches the last version, a fixture at an old
version reaches the last version, and a failing step leaves `user_version` unchanged.

## Error boundaries

| Boundary | Where | Catches | Shows |
| --- | --- | --- | --- |
| Root | `app/_layout.tsx` exports `ErrorBoundary` | Any uncaught render error in the app | Full-screen crash view with restart |
| Route | A route file exports `ErrorBoundary` | Errors in that route's tree, including a facade's deliberate throw | Inline fallback with retry; the rest of the app stays |

```tsx
// app/items/[id].tsx
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ScreenError error={error} onRetry={retry} />;
}
export { ItemPage as default } from '@/features/items/pages';
```

Add a route boundary when the screen does a risky operation whose failure should not take the
tabs down, and a retry makes sense. Do not add one when the facade already surfaces the failure
as a toast or inline state.

## Toast, inline or boundary

| Scenario | Surface |
| --- | --- |
| A background mutation fails (save, toggle, delete) | Toast: non-blocking |
| A form submission fails | Inline error state next to the form |
| A screen's main data or operation fails (a detail page, a generation) | Route `ErrorBoundary` with retry |
| An unexpected crash | Root `ErrorBoundary` |
| The runtime fails to boot | The fatal screen from `runtime.boot()` |

## `useErrorMessage`

`useErrorMessage(error, mapper, t)` from `@timothyrusso/effect-core/react` returns the translated
message for an error, or `undefined` when there is none: it looks the tag up in the exhaustive
mapper and passes the key to `t`. `core/error` binds it to the app's mapper and translation hook
once, so callers pass only the error:

```ts
// features/core/error/hooks/useAppErrorMessage.ts
export const useAppErrorMessage = (error: AppError | null | undefined) =>
  useErrorMessage(error, errorTagToMessageKey, useT().t);
```

Toast helpers use the same mapper, so a toast and an inline message for the same tag say the same
thing.

## Rules

1. **Failures are in `E`.** A function that can fail returns an Effect; nothing throws across a
   layer.
2. **One class per failure mode,** `AppErrorBase` in `domain/errors/`, registered in
   `AppErrorRegistry`.
3. **The union is closed and the mapper exhaustive,** in `core/error`, checked by tsc.
4. **`toAppError` or a specific error in every `catch`.** Never `as Error`
   (`no-restricted-syntax`).
5. **Log once, at the runtime boundary.** No logging in Layers, use cases, facades or ViewModels
   (no rule sees a `Logger` call; the reviewer catches it). Never the console (Biome `noConsole`).
6. **Retries in the Effect,** not in TanStack Query.
7. **Boot once** with `await runtime.boot()` and handle its failure there.
8. **Never render `error.message`:** always `useErrorMessage`.
9. **Root boundary always present;** route boundaries for risky screens.
10. **Toast for mutations, inline for forms, boundary for screens.**
