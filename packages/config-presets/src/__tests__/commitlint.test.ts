import { join } from 'node:path';
import lint from '@commitlint/lint';
import load from '@commitlint/load';
import { PACKAGE_ROOT } from './helpers.js';

async function check(message: string) {
  const config = await load({}, { file: join(PACKAGE_ROOT, 'commitlint.config.cjs'), cwd: PACKAGE_ROOT });
  const result = await lint(message, config.rules, {
    plugins: config.plugins,
    ...(config.parserPreset?.parserOpts ? { parserOpts: config.parserPreset.parserOpts } : {}),
  });
  return result.errors.map(error => error.name).sort();
}

describe('commitlint preset', () => {
  it('accepts type(issue): message', async () => {
    expect(await check('feat(12): add the settings screen')).toEqual([]);
    expect(await check('build(3): bump expo')).toEqual([]);
  });

  it('requires an issue number as the scope', async () => {
    expect(await check('feat: add the settings screen')).toEqual(['scope-empty', 'scope-issue-number']);
    expect(await check('feat(settings): add the settings screen')).toEqual(['scope-issue-number']);
  });

  it('accepts proper nouns in the subject', async () => {
    expect(await check('docs(9): architecture and the Effect primer')).toEqual([]);
  });

  it('allows only the kit types', async () => {
    expect(await check('style(12): tidy')).toEqual(['type-enum']);
  });
});
