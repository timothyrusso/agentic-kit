import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KitConfigError, loadKitConfig, parseKitConfig } from '../kitConfig.js';

const full = {
  projectName: 'acme',
  featuresRoot: 'src/features',
  appRoot: 'src/app',
  github: {
    projectNumber: 7,
    projectId: 'project-id',
    statusFieldId: 'status-field-id',
    statusOptions: { todo: 'a', inProgress: 'b', done: 'c' },
    labels: ['bug'],
  },
  qa: { targets: ['mobile', 'web'], simulator: 'iPhone 17 Pro', metroPort: 8082 },
  lint: {
    allowedHooksInViews: ['useTheme'],
    dashes: 'forbid',
    layoutTokens: { gutterToken: 'screenGutter', spacingImport: '@/theme/tokens', allowlistFile: 'layout.allow' },
    singleSpinner: true,
  },
  i18n: { catalogPath: 'src/i18n', languages: ['en', 'it'] },
};

function messageOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof KitConfigError) return error.message;
    throw error;
  }
  throw new Error('expected a KitConfigError');
}

describe('parseKitConfig', () => {
  it('accepts a config that sets every field', () => {
    expect(parseKitConfig(full)).toEqual(full);
  });

  it('applies defaults to a minimal config without mutating the input', () => {
    const input = { projectName: 'acme', lint: {} };
    expect(parseKitConfig(input)).toEqual({
      projectName: 'acme',
      featuresRoot: 'features',
      appRoot: 'app',
      lint: { allowedHooksInViews: [], dashes: 'forbid', singleSpinner: false },
    });
    expect(input).toEqual({ projectName: 'acme', lint: {} });
  });

  it('rejects a config missing projectName with a readable message', () => {
    const { projectName: _omitted, ...rest } = full;
    expect(() => parseKitConfig(rest)).toThrow(KitConfigError);
    expect(messageOf(() => parseKitConfig(rest))).toBe(
      'Invalid kit.config.json:\n  - missing required field "projectName"',
    );
  });

  it('names nested missing fields, unknown fields and bad enum values together', () => {
    const message = messageOf(() =>
      parseKitConfig({
        projectName: 'acme',
        featuresRoot: 'lib',
        github: { ...full.github, statusOptions: { todo: 'a', done: 'c' } },
        lint: { dashes: 'sometimes', extra: true },
      }),
    );
    expect(message).toContain('missing required field "github.statusOptions.inProgress"');
    expect(message).toContain('"featuresRoot" must be one of: features, src/features');
    expect(message).toContain('"lint.dashes" must be one of: forbid, allow');
    expect(message).toContain('unknown field "lint.extra"');
  });

  it('rejects a value that is not an object', () => {
    expect(messageOf(() => parseKitConfig([]))).toContain('the config must be object');
  });
});

describe('loadKitConfig', () => {
  it('finds the nearest kit.config.json above cwd', () => {
    const root = mkdtempSync(join(tmpdir(), 'kit-config-'));
    writeFileSync(join(root, 'kit.config.json'), JSON.stringify({ projectName: 'acme' }));
    const nested = mkdtempSync(join(root, 'nested-'));
    expect(loadKitConfig({ cwd: nested }).projectName).toBe('acme');
  });

  it('names the file when the JSON is invalid', () => {
    const root = mkdtempSync(join(tmpdir(), 'kit-config-'));
    const file = join(root, 'kit.config.json');
    writeFileSync(file, '{ "projectName": ');
    expect(messageOf(() => loadKitConfig({ path: file }))).toContain(`${file} is not valid JSON`);
  });

  it('validates the kit repository own kit.config.json', () => {
    expect(loadKitConfig({ path: '../../kit.config.json' }).github?.projectNumber).toBe(2);
  });
});
