import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkText, dashHits, replaceDashes } from '../checks/text.js';
import { cleanup, writeTree } from './helpers.js';

afterAll(cleanup);

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const forbid = { lint: { dashes: 'forbid' as const } };

describe('checkText', () => {
  it('finds dashes in every text file type, not only code', () => {
    const root = writeTree({
      'README.md': `# Acme ${EM} an app\n`,
      'app.json': `{ "name": "a ${EN} b" }\n`,
      'targets/Watch.swift': 'let ok = 1\n',
      'assets/icon.png': EM,
      'package-lock.json': EM,
    });
    const result = checkText({ rootDir: root, config: forbid });
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual([
      `README.md:1  em dash  # Acme ${EM} an app`,
      `app.json:1  en dash  { "name": "a ${EN} b" }`,
    ]);
  });

  it('lists files through git, so ignored files are skipped', () => {
    const root = writeTree({ '.gitignore': 'build.log\n', 'build.log': EM, 'notes.md': 'fine\n' });
    execFileSync('git', ['init', '-q'], { cwd: root });
    expect(checkText({ rootDir: root, config: forbid })).toMatchObject({
      ok: true,
      summary: 'PASS: no em or en dashes in 2 file(s)',
    });
  });

  it('checks only the given files', () => {
    const root = writeTree({ 'a.md': EM, 'b.md': 'fine' });
    expect(checkText({ rootDir: root, config: forbid, files: ['b.md'] }).ok).toBe(true);
  });

  it('checks a commit message', () => {
    expect(checkText({ rootDir: writeTree({}), config: forbid, message: `feat(1): a ${EM} b` }).problems).toEqual([
      `commit message:1  em dash  feat(1): a ${EM} b`,
    ]);
  });

  it('skips when lint.dashes is allow', () => {
    const root = writeTree({ 'a.md': EM });
    expect(
      checkText({
        rootDir: root,
        config: { lint: { dashes: 'allow' } },
      }),
    ).toMatchObject({
      ok: true,
      summary: expect.stringMatching(/^SKIP/),
    });
  });
});

describe('dashHits', () => {
  it('reports one line per dash kind per line', () => {
    expect(dashHits('f', `a\n${EM}${EN}`)).toEqual([`f:2  em dash  ${EM}${EN}`, `f:2  en dash  ${EM}${EN}`]);
  });
});

describe('check-text --fix', () => {
  it('replaces a numeric range with a hyphen and any other dash with a spaced hyphen', () => {
    expect(replaceDashes(`8${EN}12 reps\nFast ${EM} and light${EM}ish\n`)).toBe('8-12 reps\nFast - and light - ish\n');
  });

  it('rewrites the files and reports them', () => {
    const root = writeTree({ 'AGENTS.md': `# A ${EM} b\n`, 'ok.md': 'fine\n' });
    const result = checkText({ rootDir: root, config: forbid, fix: true });
    expect(result).toMatchObject({ ok: true, problems: ['AGENTS.md'] });
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toBe('# A - b\n');
    expect(checkText({ rootDir: root, config: forbid }).ok).toBe(true);
  });
});
