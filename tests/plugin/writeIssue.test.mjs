import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkKitConfig, findKitConfig, KitConfigReadError } from '../../plugin/scripts/kit-config.mjs';
import { createIssue, formatDryRun, ownerFromRemote, parseArgs, planIssue } from '../../plugin/scripts/write-issue.mjs';

const SCRIPT = fileURLToPath(new URL('../../plugin/scripts/write-issue.mjs', import.meta.url));

const config = {
  projectName: 'acme',
  github: {
    projectNumber: 3,
    projectId: 'board-id',
    statusFieldId: 'status-field',
    statusOptions: { todo: 'opt-todo', inProgress: 'opt-doing', done: 'opt-done' },
    labels: ['bug', 'enhancement'],
  },
};

const body = '### Description\nShow a banner.\n\n### Acceptance criteria\n- [ ] The banner shows\n';

describe('write-issue plan', () => {
  it('takes the board, the status option and the label from kit.config.json', () => {
    const plan = planIssue(config, { title: 'Show a banner', body, owner: 'acme-org' });
    expect(plan.problems).toEqual([]);
    expect(plan.title).toBe('[Feature]: Show a banner');
    expect(plan.labels).toEqual(['enhancement']);
    expect(plan.board).toEqual({
      projectNumber: 3,
      owner: 'acme-org',
      projectId: 'board-id',
      statusFieldId: 'status-field',
      statusOptionId: 'opt-todo',
    });
    expect(plan.commands.map(command => command.slice(0, 3))).toEqual([
      ['gh', 'issue', 'create'],
      ['gh', 'project', 'item-add'],
      ['gh', 'project', 'item-edit'],
    ]);
  });

  it('does not double the title prefix and applies no label the config does not allow', () => {
    const plan = planIssue(
      { ...config, github: { ...config.github, labels: [] } },
      { title: '[Feature]: Banner', body, owner: 'o' },
    );
    expect(plan.title).toBe('[Feature]: Banner');
    expect(plan.labels).toEqual([]);
  });

  it('plans no board without a github section', () => {
    const plan = planIssue({ projectName: 'acme' }, { title: 'Banner', body, owner: null });
    expect(plan.board).toBeNull();
    expect(plan.commands).toHaveLength(1);
    expect(plan.problems).toEqual([]);
  });

  it('refuses a body without the template headings and a board without an owner', () => {
    const plan = planIssue(config, { title: ' ', body: 'just text', owner: null });
    expect(plan.problems).toEqual([
      'the body has no "### Description" heading',
      'the body has no "### Acceptance criteria" heading',
      'the title is empty',
      'the board owner could not be read from the origin remote',
    ]);
  });

  it('prints the dry run with every id and no created issue', () => {
    const text = formatDryRun(planIssue(config, { title: 'Banner', body, owner: 'acme-org' }));
    expect(text).toContain('nothing was created');
    expect(text).toContain('Board:  project 3 of acme-org, id board-id');
    expect(text).toContain('Status: field status-field, option opt-todo');
    expect(text).toContain("gh issue create --title '[Feature]: Banner' --body-file '<body file>' --label enhancement");
    expect(text).toContain('### Acceptance criteria');
  });
});

describe('write-issue run', () => {
  const plan = planIssue(config, { title: 'Banner', body, owner: 'acme-org' });

  it('creates the issue, adds it to the board and sets its status', () => {
    const calls = [];
    const gh = args => {
      calls.push(args);
      if (args[0] === 'issue') return 'https://github.com/acme-org/app/issues/9';
      if (args[1] === 'item-add') return 'ITEM_1';
      return '';
    };
    expect(createIssue(plan, '/tmp/body.md', gh)).toEqual({
      issueUrl: 'https://github.com/acme-org/app/issues/9',
      addedToBoard: true,
      statusSet: true,
      problems: [],
    });
    expect(calls[0]).toContain('/tmp/body.md');
    expect(calls[1]).toEqual(expect.arrayContaining(['item-add', '3', '--owner', 'acme-org']));
    expect(calls[2]).toEqual(expect.arrayContaining(['--id', 'ITEM_1', '--single-select-option-id', 'opt-todo']));
  });

  it('keeps the issue and reports the remediation when the board call fails', () => {
    const gh = args => {
      if (args[0] === 'issue') return 'https://github.com/acme-org/app/issues/9';
      throw Object.assign(new Error('Command failed'), { stderr: 'missing required scopes [project]' });
    };
    const result = createIssue(plan, '/tmp/body.md', gh);
    expect(result).toMatchObject({ issueUrl: 'https://github.com/acme-org/app/issues/9', addedToBoard: false });
    expect(result.problems[0]).toContain('gh auth refresh -s project');
    expect(result.problems[0]).toContain('missing required scopes [project]');
  });
});

describe('write-issue helpers', () => {
  it.each([
    ['git@github.com:acme-org/app.git', 'acme-org'],
    ['https://github.com/acme-org/app', 'acme-org'],
    ['https://github.com/acme-org/app.git\n', 'acme-org'],
    ['https://gitlab.com/acme-org/app.git', null],
  ])('reads the owner of %s', (url, owner) => {
    expect(ownerFromRemote(url)).toBe(owner);
  });

  it('parses the flags and rejects unknown ones', () => {
    expect(parseArgs(['--title', 'T', '--body-file', 'b.md', '--dry-run'])).toEqual({
      title: 'T',
      bodyFile: 'b.md',
      dryRun: true,
    });
    expect(() => parseArgs(['--create'])).toThrow('unexpected argument "--create"');
  });

  it('checks the fields the plugin reads from kit.config.json', () => {
    expect(() => checkKitConfig({ github: { projectNumber: 'x' } })).toThrow(KitConfigReadError);
    expect(() => checkKitConfig({ projectName: 'a', github: { projectNumber: 1 } })).toThrow(
      'missing required field "github.projectId"',
    );
    expect(checkKitConfig(config)).toBe(config);
  });

  it('finds the nearest kit.config.json and runs the dry run from the command line', () => {
    const dir = mkdtempSync(join(tmpdir(), 'write-issue-'));
    writeFileSync(join(dir, 'kit.config.json'), JSON.stringify(config));
    writeFileSync(join(dir, 'body.md'), body);
    expect(findKitConfig(dir)).toBe(join(dir, 'kit.config.json'));
    execFileSync('git', ['init', '-q'], { cwd: dir });
    execFileSync('git', ['remote', 'add', 'origin', 'git@github.com:acme-org/app.git'], { cwd: dir });
    const out = execFileSync('node', [SCRIPT, '--title', 'Banner', '--body-file', 'body.md', '--dry-run'], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(out).toContain('write-issue --dry-run for acme');
    expect(out).toContain('gh project item-add 3 --owner acme-org');
  });
});
