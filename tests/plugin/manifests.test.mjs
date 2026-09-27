import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { pipelineSource } from './pipelineHarness.mjs';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const readJson = path => JSON.parse(read(path));
const list = path => readdirSync(new URL(path, root));

/** The YAML frontmatter of a Markdown file. */
function frontmatter(path) {
  const match = read(path).match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error(`${path} has no frontmatter`);
  return parse(match[1]);
}

const agents = list('plugin/agents/').filter(name => name.endsWith('.md'));
const skills = list('plugin/skills/').filter(name => existsSync(new URL(`plugin/skills/${name}/SKILL.md`, root)));

describe('plugin manifests', () => {
  it('lists the plugin in the marketplace at the lockstep version', () => {
    const marketplace = readJson('.claude-plugin/marketplace.json');
    const plugin = readJson('plugin/.claude-plugin/plugin.json');
    const packageVersion = readJson('packages/effect-core/package.json').version;
    expect(marketplace.name).toBe('agentic-kit');
    expect(marketplace.plugins).toEqual([expect.objectContaining({ name: 'agentic-kit', source: './plugin' })]);
    expect(plugin.name).toBe('agentic-kit');
    expect(plugin.version).toBe(packageVersion);
    expect(marketplace.plugins[0].version).toBe(packageVersion);
  });

  it('ships the six agents with a name matching the file', () => {
    expect(agents.sort()).toEqual([
      'code-reviewer.md',
      'explorer.md',
      'feature-builder.md',
      'finding-vetter.md',
      'qa-engineer.md',
      'qa-web-engineer.md',
    ]);
    for (const file of agents) {
      const meta = frontmatter(`plugin/agents/${file}`);
      expect(meta.name).toBe(file.replace(/\.md$/, ''));
      expect(typeof meta.description).toBe('string');
      for (const skill of meta.skills ?? []) {
        expect(skill).toMatch(/^agentic-kit:/);
        expect(skills).toContain(skill.slice('agentic-kit:'.length));
      }
    }
  });

  it('ships every skill with a name matching its folder', () => {
    expect(skills.sort()).toEqual([
      'agent-device',
      'agent-device-configuration',
      'docs-audit',
      'dogfood',
      'grill-deck',
      'grill-me',
      'grilling',
      'handoff',
      'implement-issue',
      'qa-baseline',
      'teach',
      'triage-pr',
      'write-issue',
      'writing-great-skills',
    ]);
    for (const skill of skills) {
      const meta = frontmatter(`plugin/skills/${skill}/SKILL.md`);
      expect(meta.name).toBe(skill);
      expect(typeof meta.description).toBe('string');
    }
  });

  it('dispatches only agents the plugin ships', () => {
    const types = [...pipelineSource().matchAll(/'agentic-kit:([a-z-]+)'/g)].map(match => `${match[1]}.md`);
    expect(types.length).toBeGreaterThan(0);
    for (const type of types) expect(agents).toContain(type);
  });

  it('keeps every agent and skill reading kit.config.json instead of naming the app', () => {
    const readers = [
      ...agents.map(file => `plugin/agents/${file}`),
      'plugin/skills/write-issue/SKILL.md',
      'plugin/skills/implement-issue/SKILL.md',
      'plugin/skills/qa-baseline/SKILL.md',
      'plugin/skills/docs-audit/SKILL.md',
    ];
    for (const path of readers) expect(read(path)).toContain('kit.config.json');
  });

  it('has the Feature template headings the agents parse', () => {
    const template = parse(read('plugin/templates/ISSUE_TEMPLATE/feature.yml'));
    const labels = template.body.filter(field => field.type !== 'markdown').map(field => field.attributes.label);
    expect(labels).toEqual(['Description', 'Acceptance criteria', 'Screens affected', 'Out of scope', 'Design link']);
    expect(template.title).toBe('[Feature]: ');
  });
});
