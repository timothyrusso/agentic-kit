import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkI18n, checkUnusedKeys, flattenCatalog, type I18nKitConfig } from '../checks/i18n.js';
import { cleanup, copyFixtureApp, FIXTURE_APP, writeTree } from './helpers.js';

const config: I18nKitConfig = {
  appRoot: 'app',
  featuresRoot: 'src/features',
  i18n: { catalogPath: 'src/i18n', languages: ['en', 'it'] },
};

afterAll(cleanup);

function edit(root: string, file: string, change: (text: string) => string): void {
  const path = join(root, file);
  writeFileSync(path, change(readFileSync(path, 'utf8')));
}

describe('checkI18n on the fixture catalog', () => {
  it('passes on the catalog as shipped', async () => {
    const result = await checkI18n({ rootDir: FIXTURE_APP, config });
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.summary).toMatch(/^PASS: \d{3,} keys, en and it agree/);
  });

  it('fails when a key is removed from it.ts', async () => {
    const root = copyFixtureApp();
    edit(root, 'src/i18n/it.ts', text => {
      const next = text.replace(/^ {4}workout: 'Allenamento',\n/m, '');
      expect(next).not.toBe(text);
      return next;
    });
    const result = await checkI18n({ rootDir: root, config });
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual(['missing in it: tabs.workout']);
  });

  it('fails when a key exists only in it.ts', async () => {
    const root = copyFixtureApp();
    edit(root, 'src/i18n/it.ts', text =>
      text.replace("workout: 'Allenamento',", "workout: 'Allenamento',\n    extra: 'In piu',"),
    );
    const result = await checkI18n({ rootDir: root, config });
    expect(result.problems).toEqual(['missing in en: tabs.extra']);
  });
});

describe('checkI18n rules', () => {
  const tree = (en: string, it: string, extra: Record<string, string> = {}) =>
    writeTree({ 'src/i18n/en.ts': en, 'src/i18n/it.ts': it, ...extra });

  it('reports a plural key without its partner', async () => {
    const root = tree(
      "export const en = { set_one: '{count} set', set_other: '{count} sets' };",
      "export const it = { set_one: '{count} serie', set_other: '{count} serie', rep_one: '{count} rip' };",
    );
    const result = await checkI18n({ rootDir: root, config });
    expect(result.problems).toEqual(['missing in en: rep_one', 'it: rep_one has no _other form']);
  });

  it('reports placeholders that differ from the reference', async () => {
    const root = tree("export const en = { hi: 'Hi {name}' };", "export default { hi: 'Ciao {nome}' };");
    const result = await checkI18n({ rootDir: root, config });
    expect(result.problems).toEqual(['hi: placeholders differ (en "name" against it "nome")']);
  });

  it('reports prose typed into JSX', async () => {
    const root = tree("export const en = { a: 'A' };", "export const it = { a: 'A' };", {
      'app/index.tsx':
        'export const Screen = () => (\n  <Text>\n    Welcome to the app, this is plain prose\n  </Text>\n);\n',
    });
    const result = await checkI18n({ rootDir: root, config });
    expect(result.problems).toEqual([
      'app/index.tsx:3: copy outside the catalog: "Welcome to the app, this is plain prose"',
    ]);
  });

  it('skips when kit.config.json has no i18n section', async () => {
    const result = await checkI18n({ rootDir: FIXTURE_APP, config: { appRoot: 'app', featuresRoot: 'features' } });
    expect(result).toMatchObject({ ok: true, summary: expect.stringMatching(/^SKIP/) });
  });

  it('fails clearly when a language has no catalog file', async () => {
    const root = tree("export const en = { a: 'A' };", "export const it = { a: 'A' };");
    const withFrench = { ...config, i18n: { catalogPath: 'src/i18n', languages: ['en', 'fr'] } };
    await expect(checkI18n({ rootDir: root, config: withFrench })).rejects.toThrow('no catalog for "fr" in src/i18n');
  });
});

describe('checkUnusedKeys', () => {
  it('passes when every key is read, counting a plural key through its base', async () => {
    const root = writeTree({
      'src/i18n/en.ts': "export const en = { home: { title: 'Home', set_one: '1 set', set_other: 'sets' } };",
      'src/i18n/it.ts': "export const it = { home: { title: 'Casa', set_one: '1 serie', set_other: 'serie' } };",
      'app/index.tsx': 't(\'home.title\'); t("home.set", { count: 2 });',
    });
    expect(await checkUnusedKeys({ rootDir: root, config })).toMatchObject({ ok: true, problems: [] });
  });

  it('reports keys nothing reads, ignoring the catalog files themselves', async () => {
    const root = writeTree({
      'src/i18n/en.ts': "export const en = { a: 'A', b: 'B' }; export const keys = ['a', 'b'];",
      'src/i18n/it.ts': "export const it = { a: 'A', b: 'B' };",
      'src/features/x/ui/X.tsx': 'const label = `a`;',
    });
    const result = await checkUnusedKeys({ rootDir: root, config });
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual(['b']);
  });
});

describe('flattenCatalog', () => {
  it('keeps string leaves under dotted paths and drops other values', () => {
    expect(flattenCatalog({ a: { b: 'x', c: { d: 'y' } }, n: 1 })).toEqual([
      ['a.b', 'x'],
      ['a.c.d', 'y'],
    ]);
  });
});
