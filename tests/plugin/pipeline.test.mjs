import { pipelineMeta, runPipeline } from './pipelineHarness.mjs';

const kitConfig = {
  projectName: 'Acme Shop',
  featuresRoot: 'features',
  github: {
    projectNumber: 7,
    projectId: 'board-id',
    statusFieldId: 'status-field',
    statusOptions: { todo: 'opt-todo', inProgress: 'opt-doing', done: 'opt-done' },
    labels: ['enhancement'],
  },
  qa: { targets: ['mobile', 'web'], simulator: 'iPhone 17 Pro', metroPort: 8082 },
};

const keys = calls => calls.map(call => call.key);

describe('implement-issue-pipeline: args', () => {
  it.each([
    [{}, '`issue` must be a GitHub issue number'],
    [{ issue: 'abc' }, '`issue` must be a GitHub issue number'],
    [{ issue: 3, kitConfig, qaTargets: ['desktop'] }, '`qaTargets` must be an array of mobile|web'],
    [{ issue: 3, kitConfig, maxFix: -1 }, '`maxFix` must be a non-negative integer'],
    [{ issue: 3, kitConfig: { featuresRoot: 'features' } }, '`kitConfig` has no "projectName"'],
    [{ issue: 3, kitConfig: { projectName: 'x', qa: { targets: ['tv'] } } }, 'unknown "qa.targets" entry'],
  ])('rejects %j before any agent runs', async (args, message) => {
    const calls = [];
    await expect(
      runPipeline(args, {
        explorer: prompt => {
          calls.push(prompt);
          return null;
        },
      }),
    ).rejects.toThrow(message);
    expect(calls).toEqual([]);
  });

  it('accepts a JSON string, as a caller that stringified its args sends', async () => {
    const { result } = await runPipeline(JSON.stringify({ issue: 5, kitConfig, qa: false }));
    expect(result.prUrl).toBe('https://github.com/acme/app/pull/12');
  });

  it('accepts a bare issue number, reading kit.config.json through the Config stage', async () => {
    const { calls, phases } = await runPipeline(9);
    expect(phases[0]).toBe('Config');
    expect(keys(calls)[0]).toBe('config');
    expect(calls.find(call => call.key === 'feature-builder').prompt).toContain('issue #9 for acme');
  });

  it('stops when the Config stage finds no kit.config.json', async () => {
    await expect(runPipeline({ issue: 9 }, { config: { found: false, json: '' } })).rejects.toThrow(
      'no kit.config.json at the repository root',
    );
  });
});

describe('implement-issue-pipeline: stages', () => {
  it('reaches the build stage with qa: false and runs no QA agent', async () => {
    const { result, calls, phases } = await runPipeline({ issue: 42, kitConfig, qa: false });
    expect(phases).toEqual(['Explore', 'Build', 'Wire PR', 'Report']);
    expect(keys(calls)).toEqual(['explorer', 'feature-builder', 'wire', 'code-reviewer', 'report']);
    const build = calls.find(call => call.key === 'feature-builder');
    expect(build.prompt).toContain('Implement GitHub issue #42 for Acme Shop');
    expect(build.prompt).toContain('npm run check');
    expect(build.prompt).toContain('Exploration report');
    expect(result).toMatchObject({
      qaVerdict: 'skipped',
      qaWebVerdict: 'skipped',
      reviewVerdict: 'PASS',
      passed: true,
    });
  });

  it('uses only the plugin-namespaced agents and phases declared in meta', async () => {
    const { calls, phases } = await runPipeline({ issue: 42, kitConfig, qaTargets: ['mobile', 'web'] });
    const declared = pipelineMeta().phases.map(p => p.title);
    for (const title of [...phases, ...calls.map(call => call.options.phase).filter(Boolean)]) {
      expect(declared).toContain(title);
    }
    for (const { options } of calls) {
      expect(options.agentType === 'general-purpose' || options.agentType.startsWith('agentic-kit:')).toBe(true);
    }
  });

  it('takes the device, the Metro port and the board from kit.config.json', async () => {
    const { calls } = await runPipeline({ issue: 42, kitConfig });
    const qa = calls.find(call => call.key === 'qa-engineer');
    expect(qa.prompt).toContain('"iPhone 17 Pro"');
    expect(qa.prompt).toContain('port 8082');
    const wire = calls.find(call => call.key === 'wire');
    expect(wire.prompt).toContain('gh project item-add 7');
    expect(wire.prompt).toContain('--project-id board-id --field-id status-field --single-select-option-id opt-doing');
    expect(wire.prompt).toContain('--add-assignee @me');
  });

  it('skips the board step when kit.config.json has no github section', async () => {
    const { calls } = await runPipeline({ issue: 42, kitConfig: { projectName: 'acme' }, qa: false });
    expect(calls.find(call => call.key === 'wire').prompt).toContain('no `github` section');
  });

  it('prefixes the run comment and visual summary markers with the project name', async () => {
    const shot = '/work/app/coverage/qa/42/visual-01-home.png';
    const { calls } = await runPipeline(
      { issue: 42, kitConfig },
      {
        explorer: {
          report: 'map',
          qaTargets: ['mobile'],
          qaTargetsReason: 'a screen',
          visualSubjects: [{ capture: 'Home' }],
        },
        'qa-engineer': {
          items: [{ id: 'T01', criterion: 'it works', class: 'flow', verdict: 'PASS', note: 'ok' }],
          baseline: [{ check: 'App startup', pass: true }],
          blockingFindings: [],
          manifest: [{ path: shot, caption: 'Home tab', surface: 'iOS' }],
          report: 'qa report',
        },
      },
    );
    expect(calls.find(call => call.key === 'report').prompt).toContain('<!-- acme-shop:pipeline-run -->');
    const visual = calls.find(call => call.key === 'visual');
    expect(visual.prompt).toContain('<!-- acme-shop:visual-summary -->');
    expect(visual.prompt).toContain(shot);
  });
});

describe('implement-issue-pipeline: QA targets', () => {
  it('falls back to qa.targets from kit.config.json when explore is skipped', async () => {
    const { calls } = await runPipeline({
      issue: 1,
      kitConfig: { projectName: 'acme', qa: { targets: ['web'] } },
      explore: false,
    });
    expect(keys(calls)).toContain('qa-web-engineer');
    expect(keys(calls)).not.toContain('qa-engineer');
  });

  it('keeps only the explorer choices the app can run QA on', async () => {
    const { calls } = await runPipeline(
      { issue: 1, kitConfig: { projectName: 'acme', qa: { targets: ['mobile'] } } },
      { explorer: { report: 'map', qaTargets: ['mobile', 'web'], qaTargetsReason: 'both', visualSubjects: [] } },
    );
    expect(keys(calls)).toContain('qa-engineer');
    expect(keys(calls)).not.toContain('qa-web-engineer');
  });

  it('lets an explicit qaTargets override win', async () => {
    const { calls } = await runPipeline({ issue: 1, kitConfig, qaTargets: [] });
    expect(keys(calls)).not.toContain('qa-engineer');
    expect(keys(calls)).not.toContain('qa-web-engineer');
  });
});

describe('implement-issue-pipeline: fix loop', () => {
  it('fixes a confirmed review finding once, then passes', async () => {
    const { result, calls } = await runPipeline(
      { issue: 8, kitConfig, qa: false },
      {
        'code-reviewer': (_prompt, count) =>
          count === 1
            ? { verdict: 'CHANGES-REQUESTED', blockingFindings: ['a.ts:1 bug'], report: 'r1' }
            : { verdict: 'PASS', blockingFindings: [], report: 'r2' },
      },
    );
    expect(keys(calls).filter(key => key === 'feature-builder')).toHaveLength(2);
    expect(result).toMatchObject({ fixAttempts: 1, passed: true, stuck: false });
  });

  it('stops as stuck when the same findings come back', async () => {
    const { result } = await runPipeline(
      { issue: 8, kitConfig, qa: false, maxFix: 5 },
      { 'code-reviewer': { verdict: 'CHANGES-REQUESTED', blockingFindings: ['a.ts:1 bug'], report: 'r' } },
    );
    expect(result).toMatchObject({ fixAttempts: 1, stuck: true, passed: false });
    expect(result.outstanding).toHaveLength(1);
  });

  it('never fixes a refuted finding', async () => {
    const { result, calls } = await runPipeline(
      { issue: 8, kitConfig, qa: false },
      {
        'code-reviewer': { verdict: 'CHANGES-REQUESTED', blockingFindings: ['a.ts:1 bug'], report: 'r' },
        'finding-vetter': { verdict: 'refuted', reason: 'a.ts:1 is fine' },
      },
    );
    expect(keys(calls).filter(key => key === 'feature-builder')).toHaveLength(1);
    expect(result).toMatchObject({ fixAttempts: 0, passed: true });
    expect(result.refuted).toHaveLength(1);
  });
});
