# Effect primer

A short study guide to Effect as the kit uses it. It is not a tour of the library: it covers the
small part an app needs, and points each idea at the place you meet it. Each section ends with a
"Where you see it" line naming a kit export or an app folder.

The rules behind all of this are in [ARCHITECTURE.md](ARCHITECTURE.md) and
[ERROR_HANDLING.md](ERROR_HANDLING.md). The kit uses Effect 3.

## Why Effect here

Agents write most of the code in these apps, and a reviewer cannot read every line. Effect is
used only where the compiler can then check four things a reviewer would otherwise have to:

1. **Dependencies.** Every service a use case needs shows up in its type. If the app runtime does
   not provide it, the facade does not compile.
2. **Failures.** Every way a use case can fail shows up in its type, and must be a member of the
   app's closed `AppError` union, which the message mapper must cover in full.
3. **Formats.** A Schema is both the parser and the type. The two cannot drift apart.
4. **Test doubles.** A test swaps a real service for a fake by providing a different Layer. No
   mocking of modules.

Outside those checks Effect would only be a wordier Promise, so it stays in the inner layers. The
UI, facades, hooks and state never import it.

Where you see it: `domain/`, `data/`, `useCases/`, `di/` in every feature, and the
`effect-only-in-inner-layers` rule of `@timothyrusso/arch-rules`.

## `Effect<A, E, R>` read aloud

An Effect is a description of a program. Nothing runs until a runtime runs it. Its type has three
slots. Read `Effect<Item, ItemNotFound | SqlError, ItemRepository>` aloud as:

"A program that needs an `ItemRepository`, and then either succeeds with an `Item`, or fails
with an `ItemNotFound` or a `SqlError`."

`A` is the success value. `E` is the failure, which is `never` when it cannot fail. `R` is the
set of services it needs, which is `never` when it needs none. You rarely write these types by
hand: TypeScript infers them, and you read them in the editor tooltip.

Because the program is only a description, you can pass it around, retry it or time it out
before anything happens. Calling a function that returns an Effect does not run it.

Where you see it: the return type of every function in `useCases/`, and the `queryFn` that
`useEffectQuery` from `@timothyrusso/effect-core/react` accepts.

## `Effect.gen` and `yield*`

`Effect.gen` lets you write Effect code the way you write `async` code. `yield*` plays the part of
`await`: it runs an inner Effect and gives you its value.

```ts
export const renameItem = (id: ItemId, name: string) =>
  Effect.gen(function* () {
    const repo = yield* ItemRepository;
    const item = yield* repo.byId(id);
    if (item === undefined) return yield* new ItemNotFound({ itemId: id });
    yield* repo.save({ ...item, name });
  });
```

Three things to notice. `yield* ItemRepository` asks for a service, which adds it to `R`. If an
inner Effect fails, the block stops there, like a thrown error, and the failure type is added to
`E`. And `return yield* new ItemNotFound(...)` fails on purpose: tagged errors are Effects too.

The star matters. `yield` without the star, or a bare `repo.save(item)` with no `yield*` at all,
builds an Effect and throws it away. Nothing is saved, and nothing warns you.

For short steps, `pipe` with `Effect.map` and `Effect.flatMap` does the same work without a
generator. Use whichever reads better.

Where you see it: use cases in `useCases/`, and Live Layers built with `Layer.effect` in
`data/repositories/`.

## Tagged errors and the closed union

A tagged error is a class with a `_tag` field that names it. The kit's `AppErrorBase(tag,
messageKey)` builds one on top of Effect's `Data.TaggedError` and adds a catalog key.

```ts
export class ItemNotFound extends AppErrorBase('ItemNotFound', 'errors.itemNotFound')<{
  readonly itemId: string;
}> {}
```

The tag is how code tells errors apart without `instanceof`: `Effect.catchTag('ItemNotFound',
...)` handles one kind and removes it from `E`. It is also how the app maps an error to a message.

The app lists every error that can reach the UI in one closed union, `AppError`, and one mapper
from each tag to a catalog key. The kit's `defineAppErrors<AppError>().assertExhaustiveMessageKeys`
makes a missing tag a compile error. Each feature adds its own errors to the union from its
`domain/errors/`, so the core never has to import a feature.

A defect is different: a bug, or a throw nobody expected. You do not model defects. The runtime
boundary turns each one into an `UnexpectedError`.

Where you see it: `domain/errors/` in each feature, and `AppError` with `errorTagToMessageKey` in
`features/core/error`, built from `AppErrorBase`, `UnexpectedError` and `defineAppErrors` in
`@timothyrusso/effect-core`.

## `Context.Tag` services and `Layer`

A Tag is a named slot for a service: it says what the service can do, not how.

```ts
export class ItemRepository extends Context.Tag('items/ItemRepository')<
  ItemRepository,
  { readonly byId: (id: ItemId) => Effect.Effect<Item | undefined, SqlError | ItemCorrupt> }
>() {}
```

A Layer is a recipe that fills the slot. It can need other services itself, and it can fail
while it builds.

```ts
export const ItemRepositoryLive = Layer.effect(
  ItemRepository,
  Effect.gen(function* () {
    const db = yield* SqliteClient;
    return {
      byId: id =>
        trySql('item by id', () => db.getFirstAsync<ItemRow>(SQL, [id])).pipe(
          Effect.flatMap(row => (row === null ? Effect.succeed(undefined) : decodeItem(row))),
        ),
    };
  }),
);
```

The query alone gives a raw row. The Layer turns it into what the Tag promised: no row becomes
`undefined`, and a row is decoded with a Schema, whose failure `decodeItem` maps to the feature's
`ItemCorrupt` error.

`Layer.mergeAll` combines Layers side by side. `Layer.provide` feeds one Layer's needs from
another. The app ends up with one big Layer that fills every slot.

Only swappable things get a Tag: repositories, the database, the clock, the logger, config,
haptics, notifications, a device bridge. A pure calculation or a use case is a plain function.
Ask one question: would a test need to fake it? If yes, it is a Tag. If a test can just call it,
it is not.

Where you see it: Tags in `domain/repositories/` and `domain/services/`, Live Layers in
`data/`, the feature's merged Layer in `di/layer.ts`, and the kit's own Tags `Logger`,
`SqliteClient` and `makeConfig(schema).Config` in `@timothyrusso/effect-core`.

## The runtime and the two React hooks

A runtime is what runs Effects. It holds the built Layer, so every Effect it runs gets its
services from there. An app has exactly one, built once by `makeAppRuntime(AppLayer)`.

React code does not call the runtime. It hands Effects to two hooks that wrap TanStack Query:

```ts
const items = useEffectQuery({ queryKey: ['items'], queryFn: listActiveItems });
const rename = useEffectMutation({ mutationFn: (name: string) => renameItem(id, name) });
```

The hooks run the Effect on the app runtime, stop it when the component unmounts or the key
changes, turn a defect into an `UnexpectedError`, and log each failure once. After the app fills
in the kit's `Register` interface with its services and its error union, the hooks accept only
Effects whose `R` the runtime provides and whose `E` is in the union. A mismatch fails to
compile right at the facade.

The runtime builds its Layer lazily. Call `await runtime.boot()` once at startup, so a Layer that
cannot build (a bad config value, a database that will not open) fails there, where you can
report it, instead of failing every query silently.

Where you see it: `makeAppRuntime` and `AppServicesOf` in `@timothyrusso/effect-core`, the
runtime in `features/core/runtime`, and `EffectRuntimeProvider`, `useEffectQuery` and
`useEffectMutation` from `@timothyrusso/effect-core/react`, called in `facades/`.

## Schema: decode, encode, brand

A Schema describes a shape once and gives you three things: a type, a decoder that checks
untrusted input, and an encoder that turns the value back into its stored form.

```ts
export const ItemId = Schema.String.pipe(Schema.brand('ItemId'));
export type ItemId = typeof ItemId.Type;

export const ItemFromRow = Schema.Struct({
  id: ItemId,
  name: Schema.String,
  createdAt: Schema.DateFromString,
});
```

`Schema.decodeUnknown(ItemFromRow)(row)` returns an Effect that succeeds with an `Item` or fails
with a `ParseError` naming the bad field. `Schema.encode(ItemFromRow)(item)` goes the other way,
here turning the `Date` back into a string. A transform such as `DateFromString` is one Schema
with a stored side and an app side, so the parser and the writer cannot disagree.

A brand makes two strings different types. An `ItemId` is a string at runtime, but you cannot
pass a plain string or an `OrderId` where an `ItemId` is expected. The only way to get one is to
decode it.

Decode at the edge, where data enters: database rows, HTTP responses, files, app config. Inside
the app, values are already the right type. A parse failure of outside data is a typed error,
not a defect.

Where you see it: `domain/schemas/` for entities and brands, `data/dtos/` for wire shapes, and
`makeConfig(schema)` in `@timothyrusso/effect-core`, which decodes the app config at boot and
fails with a `ConfigError` naming the field.

## Retry and timeout

Because an Effect is a description, you can wrap it in a policy before it runs.

```ts
const fetchCatalog = getCatalog.pipe(
  Effect.retry(Schedule.exponential('200 millis').pipe(Schedule.compose(Schedule.recurs(3)))),
  Effect.timeoutFail({ duration: '10 seconds', onTimeout: () => new OfflineError() }),
);
```

`Effect.retry` runs it again on failure, following a `Schedule`. `Effect.timeoutFail` gives up
after a while with the error you choose. Put the retry inside the Effect, not in TanStack Query:
TanStack runs the whole Effect again on each attempt, and each attempt is logged, so one failure
shows up four times. The kit's advice is a query client whose `retry` skips app errors.

Time comes from Effect's `Clock`, never `Date.now()`, so tests can control it.

Where you see it: `useCases/` and `data/`, with `Clock` re-exported from
`@timothyrusso/effect-core`, and the `retry` default of the query client in `features/core/query`.

## Testing with Layers

A test runs code with test Layers in place of the Live ones. There is no module mocking.

A use case test provides a fake built straight from the Tag:

```ts
// features/items/useCases/__tests__/renameItem.test.ts
const ItemRepositoryFake = (items: Item[]) =>
  Layer.sync(ItemRepository, () => {
    const byId = new Map(items.map(item => [item.id, item]));
    return {
      list: Effect.sync(() => [...byId.values()]),
      byId: id => Effect.sync(() => byId.get(id)),
      save: item => Effect.sync(() => void byId.set(item.id, item)),
    };
  });

itEffect(
  'renames an item',
  Effect.gen(function* () {
    yield* renameItem(itemId, 'New name');
    const repo = yield* ItemRepository;
    expect((yield* repo.byId(itemId))?.name).toBe('New name');
  }),
  ItemRepositoryFake([{ id: itemId, name: 'Old name' }]),
);
```

The Live Layer gets its own test in `data/`, against a real database:

```ts
// features/items/data/repositories/__tests__/itemRepositoryLive.test.ts
itEffect(
  'reads back what it saved',
  Effect.gen(function* () {
    const repo = yield* ItemRepository;
    yield* repo.save(item);
    expect(yield* repo.byId(item.id)).toEqual(item);
  }),
  Layer.provide(ItemRepositoryLive, makeNodeSqliteLayer()),
);
```

`itEffect` is a jest test whose body is an Effect, run with the given Layer and Effect's test
services. The clock stands still until the test moves it with `advanceClock`. The SQLite Layer is
a real in-memory `node:sqlite` database, so repositories and migrations run real SQL. `collectLogs()`
gives a `Logger` that records what was logged, for the rare test that checks logging.

Tests live inside the layer they test, so the same rules apply to them. A use case test never
imports a Live Layer (`usecases-no-data-import`), and a test folder outside the inner layers could
not import `effect` at all (`effect-only-in-inner-layers`).

Where you see it: `itEffect`, `runTest`, `makeNodeSqliteLayer`, `collectLogs` and
`advanceClock` from `@timothyrusso/effect-core/testing`, used in `useCases/__tests__/` and
`data/repositories/__tests__/`, and the shared core test Layers in `features/core/testing`. What each layer's
tests must prove, and how fixtures and fakes are written, is in `TESTING.md`.

## Ten mistakes agents make

Each mistake below names the rule that catches it. Where no rule can, the reviewer does.

1. **Importing `effect` in a view, facade, hook, store or route.** Caught by
   `effect-only-in-inner-layers` across the graph, and by `arch/no-effect-in-views` on the line
   in a `.tsx`.
2. **Calling `Effect.runPromise` or `runtime.runPromise` in a facade.** Caught by
   `arch/no-effect-run-in-facades`. Hand the Effect to `useEffectQuery` or `useEffectMutation`.
3. **Importing the runtime or `ManagedRuntime` into a facade.** Caught by
   `facades-run-through-boundary`.
4. **A use case importing a Live Layer from `data/`.** Caught by `usecases-no-data-import`.
   Depend on the Tag; the runtime picks the Layer.
5. **Importing `@effect/platform`, a kit package or any other library in `domain/`.** Caught by
   `domain-pure-except-effect`. Kit error pieces come through `features/core/error`.
6. **Casting `error as Error` in a `catch`.** Caught by `no-restricted-syntax`. Use `toAppError`
   or a specific tagged error.
7. **Forgetting the star, or `yield*` altogether, on an Effect.** No rule, reviewer catches it.
   The Effect is built and dropped, and nothing runs.
8. **Logging inside a use case or a Layer.** No rule, reviewer catches it. The boundary logs
   once.
9. **Making a Tag for something with one implementation.** No rule, reviewer catches it. A pure
   function stays a plain function.
10. **Hiding a failure with `Effect.orDie` or a `catchAll` that returns a default.** No rule,
    reviewer catches it. A typed failure becomes a defect or disappears, and the user never
    learns why.

tsc itself catches two more: a service the runtime does not provide, and an error tag the mapper
does not cover.

Where you see it: the rules table in [ARCHITECTURE.md](ARCHITECTURE.md#rules-table), with the
rules from `createArchRules` in `@timothyrusso/arch-rules` and `configs.recommended` in
`@timothyrusso/eslint-plugin-arch`.

## Cheat sheet

| You want to | Write |
| --- | --- |
| Succeed with a value | `Effect.succeed(value)` |
| Fail with a typed error | `yield* new ItemNotFound({ itemId })` or `Effect.fail(error)` |
| Wrap a promise | `Effect.tryPromise({ try: () => call(), catch: cause => toAppError(cause) })` |
| Wrap a SQL call | `withSqlite('op', db => db.getAllAsync(sql))` or `trySql('op', () => ...)` |
| Wrap sync code that may throw | `Effect.try({ try: () => parse(text), catch: cause => toAppError(cause) })` |
| Run steps in order | `Effect.gen(function* () { const a = yield* stepA; ... })` |
| Transform a success | `effect.pipe(Effect.map(a => ...))` |
| Chain another Effect | `effect.pipe(Effect.flatMap(a => next(a)))` |
| Handle one error kind | `effect.pipe(Effect.catchTag('ItemNotFound', () => fallback))` |
| Map one error to a specific tagged error | `decode(row).pipe(Effect.mapError(cause => new ItemCorrupt({ cause })))` |
| Declare a service | `class X extends Context.Tag('feature/X')<X, Shape>() {}` |
| Use a service | `const x = yield* X` |
| Implement a service | `Layer.succeed(X, impl)` or `Layer.effect(X, Effect.gen(...))` |
| Combine Layers | `Layer.mergeAll(A, B)`, `Layer.provide(A, B)`, `Layer.provideMerge(A, B)` |
| Declare an error | `class E extends AppErrorBase('E', 'errors.e')<{ ... }> {}` |
| Decode input | `Schema.decodeUnknown(S)(input)` |
| Encode for storage | `Schema.encode(S)(value)` |
| Brand an id | `Schema.String.pipe(Schema.brand('ItemId'))` |
| Read the time | `yield* Clock.currentTimeMillis` |
| Retry | `Effect.retry(Schedule.exponential('200 millis').pipe(Schedule.compose(Schedule.recurs(3))))` |
| Time out | `Effect.timeoutFail({ duration: '10 seconds', onTimeout: () => new OfflineError() })` |
| Run in React | `useEffectQuery({ queryKey, queryFn })`, `useEffectMutation({ mutationFn })` |
| Show an error | `useErrorMessage(error, errorTagToMessageKey, t)` |
| Test | `itEffect('name', effect, TestLayer)` |
| Move test time | `yield* advanceClock('1 hour')` |

Where you see it: every feature's inner layers, with the imports from `effect`,
`@timothyrusso/effect-core`, `@timothyrusso/effect-core/react` and
`@timothyrusso/effect-core/testing`.
