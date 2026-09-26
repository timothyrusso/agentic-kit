import { checkHooks, staleLanguageProblems } from '../checks/hooks.js';
import { cleanup, writeTree } from './helpers.js';

afterAll(cleanup);

describe('staleLanguageProblems', () => {
  it('flags a hook that calls t() without depending on it', () => {
    const src = 'const onError = useCallback(() => alert(t("errors.save")), [id]);';
    expect(staleLanguageProblems('a.tsx', src)).toEqual([
      'a.tsx:1: hook calls t() but does not depend on it, so it keeps one language',
    ]);
  });

  it('accepts a hook that lists t', () => {
    expect(staleLanguageProblems('a.tsx', 'const label = useMemo(() => t("a"), [t]);')).toEqual([]);
  });

  it('flags a memoised component that calls tr()', () => {
    const src = 'export const Row = memo(function Row() {\n  return tr("row.title");\n});';
    expect(staleLanguageProblems('Row.tsx', src)).toEqual([
      'Row.tsx:2: memoised component calls tr(), which does not subscribe: use useT()',
    ]);
  });

  it('exempts class components, which cannot call a hook', () => {
    const src = 'class Boundary extends React.Component {}\nconst X = memo(function X() { return tr("a"); });';
    expect(staleLanguageProblems('Boundary.tsx', src)).toEqual([]);
  });
});

describe('checkHooks', () => {
  const config = { appRoot: 'app', featuresRoot: 'features', i18n: { catalogPath: 'i18n', languages: ['en'] } };

  it('scans appRoot and featuresRoot', () => {
    const root = writeTree({
      'app/index.tsx': 'const a = useMemo(() => t("x"), []);',
      'features/home/ui/Home.tsx': 'const b = useMemo(() => t("x"), [t]);',
    });
    expect(checkHooks({ rootDir: root, config })).toMatchObject({
      ok: false,
      problems: ['app/index.tsx:1: hook calls t() but does not depend on it, so it keeps one language'],
    });
  });

  it('skips without an i18n section', () => {
    expect(
      checkHooks({ rootDir: writeTree({}), config: { appRoot: 'app', featuresRoot: 'features' } }).summary,
    ).toMatch(/^SKIP/);
  });
});
