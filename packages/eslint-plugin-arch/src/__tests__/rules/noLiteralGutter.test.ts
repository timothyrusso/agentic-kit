import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { noLiteralGutter } from '../../rules/noLiteralGutter.js';
import { ruleTester } from '../ruleTester.js';

const rule = noLiteralGutter;
const allowlistFile = join(mkdtempSync(join(tmpdir(), 'no-literal-gutter-')), 'layout.allow');
writeFileSync(allowlistFile, '# Chart internals: measured pixel offsets.\napp/charts/Axis.tsx  # axis labels\n');

const options = [{ gutterToken: 'screenGutter', spacingImport: '@/theme/tokens', allowlistFile }] as const;
const SCREEN = '/app/items/index.tsx';
const IMPORT = "import { spacing, screenGutter } from '@/theme/tokens';";

ruleTester.run('no-literal-gutter', rule, {
  valid: [
    {
      name: 'the gutter token, a smaller step, zero and auto',
      filename: SCREEN,
      options,
      code: `${IMPORT}
const styles = { a: { paddingHorizontal: screenGutter, marginLeft: spacing.sm, paddingRight: 0, marginRight: 'auto' } };`,
    },
    {
      name: 'arithmetic on the token is a derived measurement',
      filename: SCREEN,
      options,
      code: `${IMPORT}\nconst s = { paddingHorizontal: spacing.xl * 2 };`,
    },
    {
      name: 'vertical padding is not an edge',
      filename: SCREEN,
      options,
      code: `${IMPORT}\nconst s = { paddingVertical: 12, marginTop: spacing.xl };`,
    },
    {
      name: 'an xl from another module is not the spacing scale',
      filename: SCREEN,
      options,
      code: "import { sizes } from '@/other';\nconst s = { paddingLeft: sizes.xl };",
    },
    {
      name: 'a file on the allowlist',
      filename: '/app/charts/Axis.tsx',
      options,
      code: 'const s = { marginLeft: 26 };',
    },
    {
      name: 'a smaller step as a layout prop',
      filename: SCREEN,
      options,
      code: 'const A = () => <Box px="sm" mx={0} />;',
    },
  ],
  invalid: [
    {
      name: 'a literal edge',
      filename: SCREEN,
      options,
      code: 'const s = { paddingHorizontal: 20, marginLeft: -4, "paddingRight": 0.5 };',
      errors: [{ messageId: 'literal' }, { messageId: 'literal' }, { messageId: 'literal' }],
    },
    {
      name: 'the non-gutter token as an edge',
      filename: SCREEN,
      options,
      code: `${IMPORT}\nconst s = { marginHorizontal: spacing.xl };`,
      errors: [
        {
          messageId: 'token',
          data: { prop: 'marginHorizontal', value: 'spacing.xl', gutter: 'screenGutter', spacing: '@/theme/tokens' },
        },
      ],
    },
    {
      name: 'through a namespace import',
      filename: SCREEN,
      options,
      code: "import * as tokens from '@/theme/tokens';\nconst s = { paddingLeft: tokens.spacing.xl };",
      errors: [{ messageId: 'token' }],
    },
    {
      name: 'px="xl" on a layout primitive, and a literal JSX style prop',
      filename: SCREEN,
      options,
      code: 'const A = () => <Box px="xl" mx={\'xl\'} paddingLeft={16} />;',
      errors: [{ messageId: 'token' }, { messageId: 'token' }, { messageId: 'literal' }],
    },
    {
      name: 'a configured non-gutter token',
      filename: SCREEN,
      options: [{ gutterToken: 'gutter', spacingImport: '@/tokens', nonGutterTokens: ['lg'] }],
      code: "import { space } from '@/tokens';\nconst s = { paddingLeft: space.lg, paddingRight: space.xl };",
      errors: [{ messageId: 'token', line: 2 }],
    },
    {
      name: 'a missing allowlist file allows nothing',
      filename: '/app/charts/Axis.tsx',
      options: [{ gutterToken: 'screenGutter', spacingImport: '@/theme/tokens', allowlistFile: 'missing.allow' }],
      code: 'const s = { marginLeft: 26 };',
      errors: [{ messageId: 'literal' }],
    },
  ],
});
