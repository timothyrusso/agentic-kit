/**
 * Runs `plugin/workflows/implement-issue-pipeline.js` the way the Workflow tool does: the script
 * body is an async function of the workflow hooks, with `export const meta` as its header. Every
 * hook is a stub, so a test drives the stages with canned agent results and inspects the calls.
 */
import { readFileSync } from 'node:fs';

export const PIPELINE_FILE = new URL('../../plugin/workflows/implement-issue-pipeline.js', import.meta.url);

const AsyncFunction = (async () => {}).constructor;

/** The script source. */
export function pipelineSource() {
  return readFileSync(PIPELINE_FILE, 'utf8');
}

/** The `meta` literal, evaluated on its own. */
export function pipelineMeta() {
  const source = pipelineSource();
  const end = source.indexOf('\n};\n');
  return new Function(`${source.slice(0, end + 3).replace('export const meta =', 'return')}`)();
}

/**
 * Canned results per agent: the key is the plugin agent name without its namespace
 * (`explorer`, `feature-builder`, ...), or the label prefix (`config`, `wire`, `report`, `visual`)
 * for the general-purpose stages. A function value receives the prompt and the call count.
 */
export function defaultResponses() {
  return {
    config: { found: true, json: JSON.stringify({ projectName: 'acme' }) },
    explorer: { report: 'map', qaTargets: ['mobile'], qaTargetsReason: 'a screen', visualSubjects: [] },
    'feature-builder': { prUrl: 'https://github.com/acme/app/pull/12', summary: 'built', report: 'build report' },
    wire: { agentDeviceReady: true, agentBrowserReady: false, note: 'ok' },
    'code-reviewer': { verdict: 'PASS', blockingFindings: [], report: 'review report' },
    'qa-engineer': {
      items: [{ id: 'T01', criterion: 'it works', class: 'flow', verdict: 'PASS', note: 'ok' }],
      baseline: [{ check: 'App startup', pass: true }],
      blockingFindings: [],
      report: 'qa report',
    },
    'qa-web-engineer': {
      items: [{ id: 'W01', criterion: 'it works', class: 'flow', verdict: 'PASS', note: 'ok' }],
      baseline: [{ check: 'Page renders', pass: true }],
      blockingFindings: [],
      report: 'web qa report',
    },
    'finding-vetter': { verdict: 'confirmed', reason: 'real' },
    report: 'posted',
    visual: { published: 1, commentAction: 'created', note: 'ok' },
  };
}

function responseKey(options) {
  const type = options?.agentType ?? '';
  if (type.startsWith('agentic-kit:')) return type.slice('agentic-kit:'.length);
  return String(options?.label ?? '').split(':')[0];
}

/**
 * Runs the pipeline with stubbed hooks.
 * @param {unknown} args the Workflow `args`
 * @param {Record<string, unknown>} [overrides] responses replacing the defaults
 */
export async function runPipeline(args, overrides = {}) {
  const responses = { ...defaultResponses(), ...overrides };
  const calls = [];
  const phases = [];
  const logs = [];
  const counts = new Map();
  const agent = async (prompt, options = {}) => {
    const key = responseKey(options);
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    calls.push({ key, prompt, options, phase: options.phase ?? phases.at(-1) ?? null });
    const response = responses[key];
    if (response === undefined) throw new Error(`no stub response for agent "${key}"`);
    return typeof response === 'function' ? response(prompt, count) : structuredClone(response);
  };
  const parallel = async thunks =>
    Promise.all(
      thunks.map(thunk =>
        Promise.resolve()
          .then(thunk)
          .catch(() => null),
      ),
    );
  const hooks = {
    args,
    agent,
    parallel,
    pipeline: async () => {
      throw new Error('pipeline() is not used by this workflow');
    },
    phase: title => phases.push(title),
    log: message => logs.push(message),
    budget: { total: null, spent: () => 0, remaining: () => Number.POSITIVE_INFINITY },
    workflow: async () => {
      throw new Error('workflow() is not used by this workflow');
    },
  };
  const body = pipelineSource().replace('export const meta =', 'const meta =');
  const run = new AsyncFunction(...Object.keys(hooks), body);
  const result = await run(...Object.values(hooks));
  return { result, calls, phases, logs };
}
