# @timothyrusso/eslint-plugin-arch

ESLint rules for the kit's architecture: the ViewModel contract, comments, dashes, layout tokens,
stable row handlers and Effect placement. Flat config only, ESLint 9.15 or later.

## Use

```sh
npm install -D @timothyrusso/eslint-plugin-arch @timothyrusso/config-presets eslint typescript
```

`eslint.config.js` at the app root:

```js
import arch from '@timothyrusso/eslint-plugin-arch';
import { loadKitConfig } from '@timothyrusso/config-presets';

export default [
  { ignores: ['node_modules/**', 'dist/**', '.expo/**'] },
  ...arch.configs.recommended(loadKitConfig()),
];
```

`configs.recommended(kitConfig)` reads `appRoot`, `featuresRoot` and the `lint` section of
`kit.config.json` (a raw parsed file works too: every field takes the schema default). It
registers the plugin as `arch`, parses every JS and TS file with `@typescript-eslint/parser`, and
turns rules on as follows:

| Rule | On when |
| --- | --- |
| `arch/viewmodel-return-shape` | always |
| `arch/prefer-viewmodel` | always, `allow` = `lint.allowedHooksInViews` (default empty) |
| `arch/no-inline-comments` | always |
| `arch/no-jsx-comment-text` | always |
| `arch/stable-row-handlers` | always |
| `arch/no-effect-in-views` | always |
| `arch/no-effect-run-in-facades` | always |
| `arch/no-relative-imports` | always, allowed only in root-level `*.config.{js,cjs,mjs,ts}` files (`DEFAULT_RELATIVE_IMPORT_ALLOW`) |
| `no-restricted-syntax` (`enum`, `as Error`) | always |
| `arch/no-dashes` | `lint.dashes` is not `allow` |
| `arch/no-literal-gutter` | `lint.layoutTokens` is set; only in `appRoot` and `<featuresRoot>/core/design-system` |
| `no-restricted-imports` (`ActivityIndicator`) | `lint.singleSpinner`; off inside the design system |

Override any of them in a later config block, for example a wider allowlist for relative imports
(an override replaces the default list, so spread it back in):

```js
import arch, { DEFAULT_RELATIVE_IMPORT_ALLOW } from '@timothyrusso/eslint-plugin-arch';

{
  files: ['**/*.ts'],
  rules: { 'arch/no-relative-imports': ['error', { allow: [...DEFAULT_RELATIVE_IMPORT_ALLOW, 'scripts'] }] },
}
```

The package also exports `rules` (for `RuleTester`), `RESTRICTED_SYNTAX`, `SOURCE_FILES`,
`DEFAULT_RELATIVE_IMPORT_ALLOW` and the
`LintKitConfig` type.

Checks that need more than one file (i18n parity, unused catalog keys, hooks, watch bounds) are
node scripts in `@timothyrusso/config-presets`, because ESLint sees one file at a time.

## Rules

### viewmodel-return-shape

A hook in a `*.logic.ts` file returns an object literal whose keys are a non-empty subset of
`{ state, derived, effects }`, or returns nothing. Spreads and computed keys are rejected because
they cannot be checked. Returns inside nested functions belong to those functions.

### prefer-viewmodel

A `.tsx` that imports its sibling `.logic` module (same basename) calls only that ViewModel hook,
at most once. Any other hook call, including `React.useState` and another view's ViewModel, is
reported unless its name is in `allow`. A `.tsx` without a `.logic` import is presentational and
exempt, and so are test files.

### no-inline-comments

Only `// NOTE:` and `// HACK:` codetags (a codetag may wrap onto the `//` lines directly under
it), tool directives (`eslint-disable`, `biome-ignore`, `@ts-expect-error`, triple-slash
references), a shebang, and TSDoc `/** */` blocks. A TSDoc block must lead a top-level
declaration, a class or interface member, an `export` statement, or the first import (a file
overview).

### no-dashes

No em dash (U+2014) anywhere in the file. No en dash (U+2013) in string literals, template text,
JSX text or comments. A numeric range takes a hyphen (`8-12`).

### no-literal-gutter

A horizontal padding or margin (`paddingHorizontal`, `paddingLeft`, `paddingRight`,
`paddingStart`, `paddingEnd` and the `margin` equivalents, as a style key or a JSX prop, plus the
`px`, `mx`, `pl`, `pr`, `ml`, `mr` layout props) is never a literal number other than 0, and never
the non-gutter token of the spacing scale (`spacing.xl` by default). Use the gutter token for a
screen edge and a smaller step inside a component. Arithmetic on a token passes.

Options: `gutterToken` and `spacingImport` (from `lint.layoutTokens`: the spacing object is
whatever the file imports from `spacingImport`), `allowlistFile` (one path or glob per line,
relative to the ESLint working directory, `#` starts a comment; a missing file allows nothing),
and `nonGutterTokens` (default `['xl']`).

### no-jsx-comment-text

JSX text that starts with `//` or `/*`. Inside JSX those characters are text, which type-checks
and then fails at runtime in React Native. A comment inside `{}` passes.

### stable-row-handlers

In a file that renders a `FlashList` or `FlatList`, a function passed as a prop to a row component
(the outermost element `renderItem` returns) or to a `memo` component is a `useCallback` result
or a module-level function. An inline arrow, a function expression, a `.bind()` call or a function
declared inside the component is reported. Props and ViewModel members (`effects.select`) pass,
since their stability is decided elsewhere.

### no-effect-in-views

A `.tsx` never imports `effect`, a subpath of it or an `@effect/*` package, including type-only
imports, re-exports, `import()` and `require()`. The `effect-only-in-inner-layers` rule of
`@timothyrusso/arch-rules` catches the same import across the graph; this one puts the message on
the line.

### no-effect-run-in-facades

In a file under `facades/`: no `.runPromise`, `.runSync`, `.runFork`, `.runCallback` (or their
`Exit` variants) on anything, and no `ManagedRuntime` import. The dependency-cruiser rule
`facades-run-through-boundary` sees modules, not the names imported from them; this rule sees
names. Facades hand Effects to `useEffectQuery` and `useEffectMutation`.

### no-relative-imports

`./` and `../` in imports, re-exports, `import()`, `require()` and `import('...')` types, unless
the file is in one of the `allow` globs (relative to the ESLint working directory; `*` stays in
one folder, `**` spans folders, `{a,b}` matches either, a folder covers everything under it). The
recommended config allows root-level `*.config.{js,cjs,mjs,ts}` files, which import their
neighbours (`./kit.config.json`) by nature.

## Develop

Tests are Jest with `@typescript-eslint/rule-tester`, one file per rule in
`src/__tests__/rules/`. `src/__tests__/recommended.test.ts` lints the Expo-shaped fixture app in
`src/__tests__/fixtures/app` through ESLint's `ESLint` class with `configs.recommended` and its
`kit.config.json`: the clean files report nothing, and every file with `broken` in its path
reports exactly its deliberate violations. The fixture app is excluded from Biome, the kit's own
ESLint run, `tsc` and dependency-cruiser.
