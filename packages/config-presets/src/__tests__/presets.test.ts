import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { PACKAGE_ROOT } from './helpers.js';

const require = createRequire(import.meta.url);
const read = (file: string) => readFileSync(join(PACKAGE_ROOT, file), 'utf8');
const readJson = (file: string) => JSON.parse(read(file));

describe('presets', () => {
  it('exports every preset path an app extends', () => {
    const { exports } = readJson('package.json');
    expect(exports).toMatchObject({
      './biome': './biome/base.json',
      './commitlint': './commitlint.config.cjs',
      './tsconfig/expo.json': './tsconfig/expo.json',
      './jest': './jest/preset.js',
    });
  });

  it('tsconfig/expo.json extends Expo with the strict flags and the @/ alias', () => {
    const { extends: base, compilerOptions } = readJson('tsconfig/expo.json');
    expect(base).toBe('expo/tsconfig.base');
    expect(compilerOptions).toMatchObject({
      strict: true,
      noUncheckedIndexedAccess: true,
      noImplicitOverride: true,
      noFallthroughCasesInSwitch: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      verbatimModuleSyntax: true,
      paths: { '@/*': [`\${configDir}/*`] },
    });
  });

  it('jest/preset.js extends jest-expo with the @/ mapper and __tests__ matching', () => {
    const preset = require(join(PACKAGE_ROOT, 'jest/preset.js'));
    expect(preset.preset).toBe('jest-expo');
    expect(preset.moduleNameMapper).toEqual({ '^@/(.*)$': '<rootDir>/$1' });
    expect(preset.testMatch).toEqual(['<rootDir>/**/__tests__/**/*.test.{ts,tsx,js,jsx}']);
  });

  it('biome/base.json carries no app-specific paths', () => {
    const text = read('biome/base.json');
    expect(text).not.toMatch(/convex|storybook|createSelectors|claude/i);
  });

  it('lefthook.yml runs Biome, ESLint and the text check before commit, commitlint and the issue check on the message', () => {
    const text = read('lefthook.yml');
    expect(text).toMatch(/pre-commit:[\s\S]*biome check --write[\s\S]*eslint[\s\S]*check-text/);
    expect(text).toMatch(/commit-msg:[\s\S]*commitlint --edit[\s\S]*issue-number[\s\S]*check-text --message/);
  });

  it('the Claude settings template denies hook bypasses, force pushes and secret reads', () => {
    const { permissions } = readJson('.claude/settings.template.json');
    expect(permissions.deny).toEqual(
      expect.arrayContaining([
        'Bash(git commit *--no-verify*)',
        'Bash(git push *--no-verify*)',
        'Bash(git push *--force*)',
        'Read(~/.ssh/**)',
        'Read(./.env)',
        'Read(./.env.*)',
      ]),
    );
  });

  it('pr-checks.yml runs the check, the iOS bundle and the marker comment', () => {
    const text = read('github/pr-checks.yml');
    expect(text).toContain('- run: npm run check');
    expect(text).toContain('npx expo export --platform ios');
    expect(text).toContain("const marker = '<!-- arch-violations -->';");
    expect(text).toContain('runs-on: macos-latest');
    expect(text).not.toContain(`\${{ steps.arch.outputs.output }}`);
  });
});
