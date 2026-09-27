import { planDepsCheck, runDepsCheck } from '../checks/deps.js';
import { cleanup, writeTree } from './helpers.js';

afterAll(cleanup);

const config = { appRoot: 'app', featuresRoot: 'features' };

describe('check-deps', () => {
  it('cruises featuresRoot and appRoot, those that exist, with the first config file found', () => {
    const root = writeTree({
      'features/a/index.ts': '',
      '.dependency-cruiser.mjs': '',
      '.dependency-cruiser.json': '',
    });
    expect(planDepsCheck({ rootDir: root, config })).toEqual({
      roots: ['features'],
      configFile: '.dependency-cruiser.mjs',
    });
  });

  it('passes with a note while neither folder exists', () => {
    const root = writeTree({ '.dependency-cruiser.mjs': '' });
    const lines: string[] = [];
    expect(runDepsCheck({ rootDir: root, config }, line => lines.push(line))).toBe(0);
    expect(lines).toEqual(['PASS: no features/ or app/ folder yet, nothing to cruise']);
  });

  it('fails without a dependency-cruiser config', () => {
    const lines: string[] = [];
    expect(runDepsCheck({ rootDir: writeTree({ 'app/a.ts': '' }), config }, line => lines.push(line))).toBe(1);
    expect(lines[0]).toMatch(/^FAIL: no dependency-cruiser config/);
  });
});
