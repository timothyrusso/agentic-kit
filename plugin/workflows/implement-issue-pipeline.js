export const meta = {
  name: 'implement-issue-pipeline',
  description:
    'The issue implementation pipeline (single encoding): explore, build, wire PR, review with runtime QA in parallel, finding vetting, bounded auto-fix, one consolidated run comment, visual summary. Every app-specific value comes from kit.config.json. Gate-free: any clarify or grill conversation happens in the /implement-issue skill BEFORE this launches; approval happens at PR review.',
  whenToUse:
    'Launched by the /implement-issue skill after its interactive judgment, or invoked directly (headless or batch) on a crisp, pre-approved issue. Args: { issue, kitConfig?, explore?, review?, qa?, qaTargets?, worktree?, maxFix?, clarifications?, explorerReport? }.',
  phases: [
    { title: 'Config', detail: 'read kit.config.json when the caller did not pass kitConfig' },
    { title: 'Explore', detail: 'explorer maps the issue onto the architecture (default on)' },
    { title: 'Build', detail: 'feature-builder implements and opens the PR' },
    { title: 'Wire PR', detail: 'assign the PR, add it to the board, check the QA CLIs (best-effort)' },
    { title: 'Review', detail: 'code-reviewer checks the diff against the rules (parallel with QA)' },
    { title: 'QA', detail: 'qa-engineer drives the app on a device, only when the issue has a mobile surface' },
    { title: 'Web QA', detail: 'qa-web-engineer drives Chromium, only when the issue has a web surface' },
    { title: 'Vet', detail: 'one skeptic per blocking finding tries to refute it before it can trigger a fix' },
    { title: 'Fix', detail: 'feature-builder addresses confirmed findings (history-aware, stops early if stuck)' },
    { title: 'Report', detail: 'post the ONE consolidated run comment (best-effort, even on abort)' },
    {
      title: 'Visual summary',
      detail: 'publish the QA screenshots on a per-PR evidence branch and post or update the marker comment',
    },
  ],
};

/**
 * ARGS: parse, validate and derive the run options. Everything up to the first `agent()` call is
 * pure, so `tests/plugin/pipeline.test.mjs` drives it with stubbed hooks.
 */
const DEFAULT_MAX_FIX_ROUNDS = 2;
const VALID_QA_TARGETS = ['mobile', 'web'];

let rawArgs = args;
if (typeof rawArgs === 'string') {
  try {
    rawArgs = JSON.parse(rawArgs);
  } catch {}
}

const opts = typeof rawArgs === 'object' && rawArgs !== null ? rawArgs : { issue: rawArgs };

const issue = opts.issue;

if (!issue || !/^\d+$/.test(String(issue))) {
  throw new Error(`implement-issue-pipeline: \`issue\` must be a GitHub issue number, got: ${JSON.stringify(issue)}`);
}

const suppliedReport = typeof opts.explorerReport === 'string' && opts.explorerReport.trim() ? opts.explorerReport : null;

const clarifications =
  typeof opts.clarifications === 'string' && opts.clarifications.trim() ? opts.clarifications : null;

const doExplore = opts.explore !== false && !suppliedReport;

const doReview = opts.review !== false;

const doQa = opts.qa !== false;

// NOTE: `null` lets the explorer decide (see the resolution after Explore); an explicit array pins
// the run, e.g. { qaTargets: ['web'] } forces web-only QA on a headless run.
let qaTargetsOverride = null;
if (opts.qaTargets !== undefined) {
  if (!Array.isArray(opts.qaTargets) || opts.qaTargets.some(t => !VALID_QA_TARGETS.includes(t))) {
    throw new Error(
      `implement-issue-pipeline: \`qaTargets\` must be an array of ${VALID_QA_TARGETS.join('|')}, got: ${JSON.stringify(opts.qaTargets)}`,
    );
  }
  qaTargetsOverride = [...new Set(opts.qaTargets)];
}

const worktree = opts.worktree === true;

if (opts.maxFix !== undefined && (!Number.isInteger(opts.maxFix) || opts.maxFix < 0)) {
  throw new Error(`implement-issue-pipeline: \`maxFix\` must be a non-negative integer, got: ${JSON.stringify(opts.maxFix)}`);
}
const MAX_FIX = opts.maxFix === undefined ? DEFAULT_MAX_FIX_ROUNDS : opts.maxFix;

const iso = worktree ? { isolation: 'worktree' } : {};

/** Checks the `kit.config.json` fields this workflow reads; the full schema check is the app's `npm run check`. */
function checkKitConfig(value, origin) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`implement-issue-pipeline: ${origin} must be the parsed kit.config.json object`);
  }
  if (typeof value.projectName !== 'string' || !value.projectName.trim()) {
    throw new Error(`implement-issue-pipeline: ${origin} has no "projectName"`);
  }
  const targets = value.qa && Array.isArray(value.qa.targets) ? value.qa.targets : null;
  if (targets && targets.some(t => !VALID_QA_TARGETS.includes(t))) {
    throw new Error(`implement-issue-pipeline: ${origin} has an unknown "qa.targets" entry: ${JSON.stringify(targets)}`);
  }
  return value;
}

if (opts.kitConfig !== undefined) checkKitConfig(opts.kitConfig, '`kitConfig`');

/** Lower-case slug of the project name, used in the hidden comment markers. */
function projectSlug(name) {
  return (
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'app'
  );
}

/** SCHEMAS: the structured-output contract of each agent stage. */
const CONFIG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    found: { type: 'boolean' },
    json: { type: 'string' },
  },
  required: ['found', 'json'],
};

const EXPLORE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    report: { type: 'string' },
    qaTargets: {
      type: 'array',
      items: { enum: ['mobile', 'web'] },
    },
    qaTargetsReason: { type: 'string' },
    visualSubjects: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          capture: { type: 'string' },
        },
        required: ['capture'],
      },
    },
  },
  required: ['report', 'qaTargets', 'qaTargetsReason'],
};

const BUILD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    prUrl: { type: 'string' },
    summary: { type: 'string' },
    report: { type: 'string' },
  },
  required: ['prUrl', 'summary', 'report'],
};

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: { enum: ['PASS', 'CHANGES-REQUESTED'] },
    blockingFindings: { type: 'array', items: { type: 'string' } },
    report: { type: 'string' },
  },
  required: ['verdict', 'blockingFindings', 'report'],
};

const QA_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          criterion: { type: 'string' },
          class: { enum: ['flow', 'edge', 'ux'] },
          verdict: { enum: ['PASS', 'FAIL', 'BLOCKED', 'NEEDS-REVIEW'] },
          note: { type: 'string' },
        },
        required: ['id', 'criterion', 'class', 'verdict', 'note'],
      },
    },
    baseline: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          check: { type: 'string' },
          pass: { type: 'boolean' },
        },
        required: ['check', 'pass'],
      },
    },
    blockingFindings: { type: 'array', items: { type: 'string' } },
    notPerformedReason: { type: 'string' },
    manifest: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string' },
          caption: { type: 'string' },
          surface: { enum: ['iOS', 'Android'] },
        },
        required: ['path', 'caption', 'surface'],
      },
    },
    report: { type: 'string' },
  },
  required: ['items', 'baseline', 'blockingFindings', 'report'],
};

const VET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: { enum: ['confirmed', 'refuted', 'suspect'] },
    reason: { type: 'string' },
  },
  required: ['verdict', 'reason'],
};

const WIRE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    agentDeviceReady: { type: 'boolean' },
    agentBrowserReady: { type: 'boolean' },
    note: { type: 'string' },
  },
  required: ['agentDeviceReady', 'agentBrowserReady', 'note'],
};

const VISUAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    published: { type: 'number' },
    commentAction: { enum: ['created', 'updated', 'failed'] },
    note: { type: 'string' },
  },
  required: ['published', 'commentAction', 'note'],
};

/** REPORTING: the ONE consolidated PR comment. */
function clip(text, max) {
  const s = typeof text === 'string' ? text : '';
  return s.length > max ? `${s.slice(0, max)}\n\n_(truncated)_` : s;
}

function section(title, body) {
  return `<details>\n<summary>${title}</summary>\n\n${body && body.trim() ? body : '_not available_'}\n\n</details>`;
}

function buildFinalComment() {
  const status = abortError
    ? `ABORTED at ${abortStage}`
    : outstanding.length === 0 && vetted.suspect.length === 0
      ? 'PASSED'
      : 'NOT PASSED';
  const reviewV = doReview ? (review ? review.verdict : 'n/a') : 'skipped';
  const ranMobile = doQa && qaTargets.includes('mobile');
  const ranWeb = doQa && qaTargets.includes('web');
  const qaV = ranMobile ? (qa ? qaVerdictFrom(qa) : 'n/a') : 'skipped';
  const qaWebV = ranWeb ? (qaWeb ? qaVerdictFrom(qaWeb) : 'n/a') : 'skipped';

  const attention = [];
  if (abortError) attention.push(`- aborted at ${abortStage}: ${abortError.message || abortError}`);
  for (const f of outstanding) attention.push(`- outstanding [${f.source}] ${clip(f.text, 300)}`);
  for (const f of vetted.suspect) attention.push(`- suspect, needs human verification [${f.source}] ${clip(f.text, 300)}`);
  if (stuck) attention.push('- fix loop stopped early: no progress between rounds');
  if (vetted.refuted.length > 0)
    attention.push(`- ${vetted.refuted.length} finding(s) refuted by vetting: spot-check them in the Vetting section`);

  const vetLines = [];
  for (const f of vetted.confirmed) vetLines.push(`- CONFIRMED [${f.source}] ${clip(f.text, 300)}\n  - ${clip(f.vetReason, 300)}`);
  for (const f of vetted.suspect) vetLines.push(`- SUSPECT [${f.source}] ${clip(f.text, 300)}\n  - ${clip(f.vetReason, 300)}`);
  for (const f of vetted.refuted) vetLines.push(`- REFUTED [${f.source}] ${clip(f.text, 300)}\n  - ${clip(f.vetReason, 300)}`);

  const buildBody =
    clip(build.report, 15000) +
    fixHistory.map(h => `\n\n---\n\n**Fix round ${h.round}**: ${h.summary}\n\n${clip(h.report, 8000)}`).join('');

  const parts = [
    RUN_MARKER,
    `## ${projectName} pipeline run: issue #${issue} · ${status}`,
    '',
    `**review ${reviewV} · device QA ${qaV} · web QA ${qaWebV} · ${fixAttempts} fix round(s)**`,
    '',
    build.summary || '',
    attention.length > 0 ? `\n**Needs attention:**\n${attention.join('\n')}` : '',
    '',
    section('Build report', buildBody),
    section('Code review', doReview ? clip(review && review.report, 15000) : '_skipped_'),
    section('Device QA', ranMobile ? clip(qa && qa.report, 15000) : '_skipped: no mobile surface for this issue_'),
    section('Web QA', ranWeb ? clip(qaWeb && qaWeb.report, 15000) : '_skipped: no web surface for this issue_'),
  ];
  if (vetLines.length > 0) parts.push(section('Finding vetting', vetLines.join('\n')));
  return clip(parts.join('\n'), 60000);
}

/** STAGE HELPERS: verify (review in parallel with QA), verdicts, finding fingerprints, vetting. */
async function verify() {
  // NOTE: an attempt clears the previous round's results first. The lanes are reassigned only once
  // every agent is back, so an attempt that throws would otherwise leave pre-fix results in place
  // and let the visual summary publish pre-fix pixels off a post-fix head.
  review = null;
  qa = null;
  qaWeb = null;
  const wantMobile = doQa && qaTargets.includes('mobile');
  const wantWeb = doQa && qaTargets.includes('web');
  if (!doReview && !wantMobile && !wantWeb) return { review: null, qa: null, qaWeb: null };
  const kinds = [];
  const thunks = [];
  if (doReview) {
    kinds.push('review');
    thunks.push(() =>
      agent(reviewPrompt, { agentType: AGENTS.reviewer, label: `review:${issue}`, phase: 'Review', schema: REVIEW_SCHEMA }),
    );
  }
  if (wantMobile) {
    kinds.push('qa');
    thunks.push(() =>
      agent(qaPrompt(agentDeviceReady), {
        agentType: AGENTS.qa,
        label: `qa:${issue}`,
        phase: 'QA',
        schema: QA_SCHEMA,
        ...iso,
      }),
    );
  }
  if (wantWeb) {
    kinds.push('qaWeb');
    thunks.push(() =>
      agent(qaWebPrompt(agentBrowserReady), {
        agentType: AGENTS.qaWeb,
        label: `qa-web:${issue}`,
        phase: 'Web QA',
        schema: QA_SCHEMA,
        ...iso,
      }),
    );
  }
  const results = await parallel(thunks);

  const byKind = {};
  kinds.forEach((k, i) => {
    byKind[k] = results[i];
  });

  if (doReview) review = byKind.review || null;
  if (wantMobile) qa = byKind.qa || null;
  if (wantWeb) qaWeb = byKind.qaWeb || null;
  if (doReview && !byKind.review) throw new Error(`code-reviewer returned no result for issue #${issue}`);
  if (wantMobile && !byKind.qa) throw new Error(`qa-engineer returned no result for issue #${issue}`);
  if (wantWeb && !byKind.qaWeb) throw new Error(`qa-web-engineer returned no result for issue #${issue}`);

  return { review: byKind.review || null, qa: byKind.qa || null, qaWeb: byKind.qaWeb || null };
}

function qaVerdictFrom(result) {
  if (!result) return null;
  if (result.notPerformedReason) return 'NOT_PERFORMED';
  if (result.items.length === 0) return 'NOT_PERFORMED';
  const baselineFailed = result.baseline.some(b => !b.pass);
  const itemFailed = result.items.some(i => i.verdict === 'FAIL');
  return baselineFailed || itemFailed || result.blockingFindings.length > 0 ? 'FAIL' : 'PASS';
}

/**
 * Mobile QA items are T01..., web QA items W01...: a QA finding keys on its item id, so the same
 * failing item fingerprints identically across rounds and a T id never collides with a W id.
 */
function findingKey(f) {
  const isQa = f.source === 'qa' || f.source === 'qaWeb';
  const tid = isQa ? (f.text.match(/\b[TW]\d{2,}\b/) || [])[0] : null;
  return tid ? `${f.source}:${tid}` : `${f.source}:${f.text.toLowerCase().replace(/\s+/g, ' ').trim()}`;
}

function roundFingerprint(findings) {
  return findings.map(findingKey).sort().join('\n');
}

function qaBlockingFrom(result, source, out) {
  if (!result || qaVerdictFrom(result) !== 'FAIL') return;
  if (result.blockingFindings.length > 0) {
    for (const f of result.blockingFindings) out.push({ text: f, source });
  } else {
    for (const i of result.items.filter(item => item.verdict === 'FAIL')) {
      out.push({ text: `${i.id} (${i.criterion}): ${i.note}`, source });
    }
  }
}

function blockingFrom(reviewResult, qaResult, qaWebResult) {
  const out = [];
  if (reviewResult && reviewResult.verdict === 'CHANGES-REQUESTED') {
    for (const f of reviewResult.blockingFindings) out.push({ text: f, source: 'review' });
  }
  qaBlockingFrom(qaResult, 'qa', out);
  qaBlockingFrom(qaWebResult, 'qaWeb', out);
  return out;
}

function visualSlug(text) {
  const slug = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return slug || 'shot';
}

/**
 * A manifest `path` is agent-supplied, and the publisher copies what it points at onto a PUBLIC
 * evidence branch. Only a `.png` whose parent directory is exactly `coverage/qa/<issue>` may
 * travel. This is a cheap LEXICAL pre-filter: workflow scripts have no filesystem access, so the
 * publisher's shell (step 1 of visualPrompt) proves the path belongs to this repository and the
 * bytes are a PNG. It is not a `pattern` on QA_SCHEMA either: a malformed screenshot path must
 * never invalidate a whole QA result.
 */
function visualSource(path) {
  const raw = typeof path === 'string' ? path.trim() : '';
  if (!raw.startsWith('/') || raw.includes('\0') || !/\.png$/i.test(raw)) return null;
  const segments = raw.split('/');
  const file = segments.pop();
  if (!file || segments.slice(1).some(segment => segment === '' || segment === '.' || segment === '..')) return null;
  return segments.length > 4 && segments.slice(-3).join('/') === `coverage/qa/${issue}` ? raw : null;
}

function laneUnits(result) {
  if (!result || !Array.isArray(result.manifest)) return [];
  const units = [];
  for (const entry of result.manifest) {
    if (!entry || !entry.caption || !entry.surface) continue;
    const source = visualSource(entry.path);
    if (!source) {
      log(
        `Visual summary: dropped a manifest entry, not a .png directly in a coverage/qa/${issue}/ directory: ${String(entry.path).slice(0, 120)}`,
      );
      continue;
    }
    units.push({ surface: entry.surface, caption: entry.caption, source });
  }
  return units;
}

function visualPlan(result) {
  const units = laneUnits(result);
  if (units.length > MAX_VISUAL_IMAGES) log(`Visual summary: kept ${MAX_VISUAL_IMAGES} of ${units.length} shots`);
  const kept = units.slice(0, MAX_VISUAL_IMAGES);
  return kept.map((unit, index) => ({
    surface: unit.surface,
    caption: unit.caption,
    source: unit.source,
    name: `${String(index + 1).padStart(2, '0')}-${visualSlug(`${unit.surface} ${unit.caption}`)}`,
  }));
}

async function vetFindings(findings) {
  if (findings.length === 0) return { confirmed: [], refuted: [], suspect: [] };
  const results = await parallel(
    findings.map(
      (f, i) => () =>
        agent(vetPrompt(f), { agentType: AGENTS.vetter, label: `vet:${issue}#${i + 1}`, phase: 'Vet', schema: VET_SCHEMA }),
    ),
  );

  const out = { confirmed: [], refuted: [], suspect: [] };
  findings.forEach((f, i) => {
    const v = results[i];
    const verdict = v && v.verdict ? v.verdict : 'confirmed';
    out[verdict].push({ ...f, vetReason: v && v.reason ? v.reason : 'vetter unavailable: kept (fail-safe)' });
  });
  if (out.refuted.length > 0) log(`Vet: refuted ${out.refuted.length} finding(s), excluded from the fix`);
  if (out.suspect.length > 0) log(`Vet: ${out.suspect.length} suspect device claim(s) need human eyes, not auto-fixed`);
  return out;
}

/** The plugin's agents, addressed by their plugin-namespaced type. */
const AGENTS = {
  explorer: 'agentic-kit:explorer',
  builder: 'agentic-kit:feature-builder',
  reviewer: 'agentic-kit:code-reviewer',
  vetter: 'agentic-kit:finding-vetter',
  qa: 'agentic-kit:qa-engineer',
  qaWeb: 'agentic-kit:qa-web-engineer',
};

const MAX_VISUAL_IMAGES = 4;

/** STAGES: config, explore, build, wire, verify, vet, fix loop, report, visual summary. */
let kitConfig = opts.kitConfig === undefined ? null : opts.kitConfig;
if (!kitConfig) {
  phase('Config');
  const read = await agent(
    'Read the file `kit.config.json` at the root of the current git repository (`git rev-parse --show-toplevel`). Return `found: true` and its content VERBATIM as the `json` string. If there is no such file, return `found: false` and an empty `json`. Do nothing else.',
    { agentType: 'general-purpose', label: `config:${issue}`, effort: 'low', schema: CONFIG_SCHEMA },
  );
  if (!read || !read.found) {
    throw new Error(
      'implement-issue-pipeline: no kit.config.json at the repository root. Run `npx @timothyrusso/config-presets init`, or pass `kitConfig`.',
    );
  }
  try {
    kitConfig = JSON.parse(read.json);
  } catch (e) {
    throw new Error(`implement-issue-pipeline: kit.config.json is not valid JSON: ${e && e.message ? e.message : e}`);
  }
  checkKitConfig(kitConfig, 'kit.config.json');
}

const projectName = kitConfig.projectName.trim();
const slug = projectSlug(projectName);
const RUN_MARKER = `<!-- ${slug}:pipeline-run -->`;
const VISUAL_MARKER = `<!-- ${slug}:visual-summary -->`;
const qaConfig = kitConfig.qa && typeof kitConfig.qa === 'object' ? kitConfig.qa : {};
const configuredTargets = Array.isArray(qaConfig.targets) ? [...new Set(qaConfig.targets)] : null;
const board = kitConfig.github && Number.isInteger(kitConfig.github.projectNumber) ? kitConfig.github : null;

const clarificationsBlock = clarifications
  ? `\n\nClarifications from the pre-build conversation (authoritative additions to the issue's Description):\n${clarifications}`
  : '';

const deviceBlock = [
  qaConfig.simulator ? `Prefer the simulator or device named "${qaConfig.simulator}" (kit.config.json qa.simulator).` : '',
  qaConfig.metroPort
    ? `Metro must run on port ${qaConfig.metroPort} (kit.config.json qa.metroPort); never use a port another project holds.`
    : '',
]
  .filter(Boolean)
  .join(' ');

let explorerReport = suppliedReport;
let exploredQaTargets = null;
// NOTE: null means no decision was made (explore skipped, threw, or returned nothing): device QA
// judges visual relevance itself. [] means the exploration ran and proposed nothing, which turns
// capture, push and comment off for the whole run.
let exploredVisualSubjects = null;

const explorePrompt = `Run pre-implementation exploration for GitHub issue #${issue} of ${projectName} per your process: map the issue onto the architecture (target feature and tier, files and layers to touch, closest pattern to mirror, integration points, risks, suggested approach). Return the full structured exploration report as the \`report\` string.

ALSO decide which runtime surfaces this issue needs QA'd, and return them as \`qaTargets\` with a one-line \`qaTargetsReason\`. This app can be QA'd on: ${(configuredTargets || VALID_QA_TARGETS).join(', ')} (kit.config.json qa.targets); choose only among those.
- \`"mobile"\`: observable in the iOS or Android app. Driven on a device by qa-engineer.
- \`"web"\`: observable in a browser (web Storybook, \`expo start --web\`). Driven in Chromium by qa-web-engineer.
- Both, when the issue genuinely has both surfaces.
- \`[]\` (EMPTY): NO acceptance criterion can be verified at runtime (build tooling, CI, lint rules, docs, agent or workflow config, type-only changes). An empty array SKIPS QA; that is the correct answer for such issues. Do not pad the list: a QA run that can only report BLOCKED is worse than none.
Judge from the acceptance criteria and the files the change will touch, not from the title.

ALSO propose what is worth SCREENSHOTTING IN THE MOBILE APP once the change is built, as \`visualSubjects\`: one entry per subject, each a single \`capture\` line naming the state the shot must show. Propose subjects only when the change is visually relevant IN THE APP (a new screen or component reachable in the app, a restyle, a colour or spacing change, a bug fix whose symptom was visual); a component that only exists as a story gets none. Keep it to the 3 or 4 subjects that best show the change (the summary is capped at ${MAX_VISUAL_IMAGES} images). Return \`[]\` for anything with no visible result.${clarificationsBlock}`;

if (doExplore) {
  phase('Explore');
  try {
    const ex = await agent(explorePrompt, { agentType: AGENTS.explorer, label: `explore:${issue}`, schema: EXPLORE_SCHEMA });
    explorerReport = ex && ex.report ? ex.report : null;
    if (ex && Array.isArray(ex.qaTargets)) {
      const allowed = configuredTargets || VALID_QA_TARGETS;
      exploredQaTargets = [...new Set(ex.qaTargets.filter(t => allowed.includes(t)))];
      log(
        `Explorer chose QA targets: ${exploredQaTargets.length ? exploredQaTargets.join(' + ') : 'none'} (${ex.qaTargetsReason || 'no reason given'})`,
      );
    }
    if (ex) {
      const proposed = Array.isArray(ex.visualSubjects) ? ex.visualSubjects : [];
      exploredVisualSubjects = proposed.filter(s => s && s.capture);
      log(
        exploredVisualSubjects.length
          ? `Explorer proposed ${exploredVisualSubjects.length} visual subject(s): ${exploredVisualSubjects.map(s => s.capture).join(' · ')}`
          : 'Explorer proposed no visual subject: visual summary disabled for this run',
      );
    }
    if (!explorerReport) log('Explorer returned no report: the builder maps the codebase itself (non-blocking)');
  } catch (e) {
    log(`Explore phase failed (non-blocking): ${e && e.message ? e.message : e}`);
  }
}

// NOTE: resolution order is explicit override, then the explorer's judgement, then the targets in
// kit.config.json, then both surfaces, so a broken explorer can never silently switch QA off.
const qaTargets = qaTargetsOverride ?? exploredQaTargets ?? configuredTargets ?? [...VALID_QA_TARGETS];
if (qaTargetsOverride) log(`QA targets pinned by the caller: ${qaTargetsOverride.length ? qaTargetsOverride.join(' + ') : 'none'}`);
else if (exploredQaTargets === null) log(`No explorer QA decision: using ${qaTargets.join(' + ')} from kit.config.json or the default`);
if (!doQa) log('QA disabled by the caller (qa: false)');
else if (qaTargets.length === 0) log('QA skipped: no runtime surface to verify for this issue');

const explorerBlock = explorerReport
  ? `\n\nExploration report (use it as your codebase map; do not re-explore from scratch):\n${explorerReport}`
  : '';

const buildPrompt = `Implement GitHub issue #${issue} for ${projectName}, following your full process: read the issue, obey the architecture and Effect rules, verify with \`npm run check\` (once, before the commit sequence), create branch feature/${issue}, commit in small layer-aligned commits, and open the PR with an empty body. Do NOT post any PR comment. Return the PR URL, a one-line summary, and your full structured report markdown as \`report\`.${clarificationsBlock}${explorerBlock}`;

const reviewPrompt = `Review the change on branch feature/${issue} (issue #${issue} of ${projectName}) per your process. Do NOT post any PR comment. Return your verdict (PASS or CHANGES-REQUESTED), the list of blocking findings (empty if none), and your full review report markdown as \`report\`.`;

function visualCaptureBlock() {
  if (exploredVisualSubjects === null) {
    return `\n\nVISUAL CAPTURE PASS: no explorer proposal is available for this run. Judge for yourself whether this change is visually relevant; if it is, run the dedicated capture pass from your instructions AFTER the acceptance-criteria items and return the shots as \`manifest\`, otherwise return an empty \`manifest\`.`;
  }
  if (exploredVisualSubjects.length === 0) {
    return '\n\nVISUAL CAPTURE PASS: the explorer proposed no visual subject for this issue. Skip the capture pass and return an empty `manifest`.';
  }
  return `\n\nVISUAL CAPTURE PASS: AFTER the acceptance-criteria items, run the dedicated capture pass from your instructions (a fresh, deliberate shot per subject, never a reuse of an assertion screenshot) for these subjects, and return them as \`manifest\` entries with a one-line \`caption\`, the \`surface\` and an absolute \`path\` to a \`.png\` saved directly in \`coverage/qa/${issue}/\`; the pipeline publishes those bytes on a public branch, so it drops any entry pointing anywhere else:\n${exploredVisualSubjects
    .map((s, i) => `${i + 1}. ${s.capture}`)
    .join(
      '\n',
    )}\nDrop a subject you could not reach (say why in your report) and add one that shows the change better. The summary publishes at most ${MAX_VISUAL_IMAGES} images, in your order. Every failure in this pass is non-blocking.`;
}

const qaPrompt = deviceReady =>
  `Run device QA for issue #${issue} of ${projectName} on branch feature/${issue} via agent-device per your process (baseline checks, with the app-specific steps from kit.config.json qa.baseline, then the acceptance criteria). ${deviceBlock} Do NOT post any PR comment. Return the structured result mirroring your report: items[] (id, the acceptance criterion verbatim, class, verdict, one-line note with the evidence path on FAIL), baseline[] ({check, pass}), blockingFindings (empty if none), notPerformedReason ONLY if the app could not be run, and your full QA report markdown as \`report\`. Do NOT compute an overall verdict. Every acceptance criterion must appear in items; one that could not be exercised is BLOCKED with the reason.${
    deviceReady ? ' The agent-device CLI was already verified in this run: skip your own version check.' : ''
  } A separate web QA agent covers browser surfaces: mark a browser-only criterion BLOCKED as out of scope for mobile QA.${visualCaptureBlock()}`;

const qaWebPrompt = browserReady =>
  `Run web QA for issue #${issue} of ${projectName} on branch feature/${issue} via agent-browser per your process (web baseline checks, then the acceptance criteria).${
    qaConfig.metroPort ? ` A Metro-served target must use port ${qaConfig.metroPort} (kit.config.json qa.metroPort).` : ''
  } Do NOT post any PR comment. Return the structured result mirroring your report: items[], baseline[], blockingFindings (empty if none), notPerformedReason ONLY if the web target could not be served, and your full QA report markdown as \`report\`. Do NOT compute an overall verdict. Every acceptance criterion must appear in items.${
    browserReady ? ' The agent-browser CLI was already verified in this run: skip your own version check.' : ''
  } A separate mobile QA agent covers device surfaces: mark a device-only criterion BLOCKED as out of scope for web QA.`;

const fixPrompt = (findings, attempt, history, persistedKeys) =>
  `Fix mode for issue #${issue} of ${projectName} (attempt ${attempt}/${MAX_FIX}). Branch feature/${issue} and its PR already exist: do NOT create a new branch or PR, and do NOT post any PR comment. Address these CONFIRMED blocking findings as new commits on the existing branch, then return the PR URL, a one-line summary of the fixes, and your fix report markdown as \`report\`:\n${findings
    .map(
      (f, i) =>
        `${i + 1}. [${f.source}]${persistedKeys.has(findingKey(f)) ? ' [PERSISTS: a previous fix attempt did NOT clear this]' : ''} ${f.text}`,
    )
    .join('\n')}${
    history.length > 0
      ? `\n\nPrevious fix attempts in this run:\n${history
          .map(h => `- Attempt ${h.round}: "${h.summary}"`)
          .join(
            '\n',
          )}\nFindings marked [PERSISTS] survived those attempts, so the approach tried is wrong for them. Do NOT repeat it: re-diagnose from scratch (read the code around your previous fix commits, check the adjacent layer, question the assumed root cause) and take a different angle.`
      : ''
  }`;

const SOURCE_LABEL = { qa: 'device QA', qaWeb: 'web QA', review: 'code review' };

phase('Build');
const build = await agent(buildPrompt, { agentType: AGENTS.builder, label: `build:${issue}`, schema: BUILD_SCHEMA, ...iso });
if (!build || !build.prUrl) throw new Error(`build stage returned no PR for issue #${issue}`);
log(`Built issue #${issue}: ${build.prUrl}`);

const vetPrompt = f =>
  `Adversarially verify ONE ${SOURCE_LABEL[f.source] || 'code review'} finding for issue #${issue} of ${projectName} (branch feature/${issue}, PR ${build.prUrl}) per your process. The finding:\n\n"${f.text}"\n\nTry to refute it against the actual diff, code and captured QA evidence. Return confirmed, refuted or suspect with your reason.`;

const boardStep = board
  ? `2. Add the PR to the ${projectName} board and mark it in progress. The board is GitHub project ${board.projectNumber} owned by the repository owner (\`owner=$(gh repo view --json owner --jq .owner.login)\`): \`itemId=$(gh project item-add ${board.projectNumber} --owner "$owner" --url ${build.prUrl} --format json --jq .id)\`, then \`gh project item-edit --id "$itemId" --project-id ${board.projectId} --field-id ${board.statusFieldId} --single-select-option-id ${board.statusOptions.inProgress}\`. These need the \`project\` scope on the gh token: if either fails with a scope or authorization error, do NOT abort and do NOT undo step 1; note the remediation \`gh auth refresh -s project\` and carry on.`
  : '2. kit.config.json has no `github` section, so there is no board: skip this step and say so in `note`.';

const wirePrompt = `PR wiring and environment pre-check for the pull request ${build.prUrl}. Change PR METADATA ONLY: never edit the PR body or title, and do not add issue linking. Do exactly three things:
1. Assign the PR to the authenticated user: \`gh pr edit ${build.prUrl} --add-assignee @me\`.
${boardStep}
3. Check that the QA CLIs this run needs are available (read-only: do NOT install, update or add any package).${
  doQa && qaTargets.includes('mobile')
    ? ' Run `agent-device --version` and return `agentDeviceReady: true` if it reports a version, `false` if it is missing or errors.'
    : ' This run does NOT need mobile QA: skip the agent-device check and return `agentDeviceReady: false`.'
}${
  doQa && qaTargets.includes('web')
    ? ' Run `agent-browser --version` and return `agentBrowserReady: true` if it reports a version, `false` if it is missing or errors.'
    : ' This run does NOT need web QA: skip the agent-browser check and return `agentBrowserReady: false`.'
}
Summarise the outcome of all three in \`note\`.`;

let agentDeviceReady = false;
let agentBrowserReady = false;

try {
  phase('Wire PR');
  const wire = await agent(wirePrompt, { agentType: 'general-purpose', label: `wire:${issue}`, effort: 'low', schema: WIRE_SCHEMA });
  agentDeviceReady = Boolean(wire && wire.agentDeviceReady === true);
  agentBrowserReady = Boolean(wire && wire.agentBrowserReady === true);
} catch (e) {
  log(`PR wiring step failed (non-blocking): ${e && e.message ? e.message : e}`);
}

let review = null;
let qa = null;
let qaWeb = null;
let vetted = { confirmed: [], refuted: [], suspect: [] };
let fixAttempts = 0;
let stuck = false;
let abortError = null;
let abortStage = null;
const seenRounds = new Set();
const fixHistory = [];
let prevKeys = new Set();

try {
  abortStage = 'verify';
  ({ review, qa, qaWeb } = await verify());
  abortStage = 'vet';
  vetted = await vetFindings(blockingFrom(review, qa, qaWeb));

  while (vetted.confirmed.length > 0 && fixAttempts < MAX_FIX) {
    const fp = roundFingerprint(vetted.confirmed);
    if (seenRounds.has(fp)) {
      stuck = true;
      log(
        `Convergence: findings identical to a previous round, stopping early (stuck) instead of spending fix round ${fixAttempts + 1}/${MAX_FIX}`,
      );
      break;
    }
    seenRounds.add(fp);

    fixAttempts++;
    log(`Fix attempt ${fixAttempts}/${MAX_FIX}: ${vetted.confirmed.length} confirmed blocking finding(s)`);
    abortStage = `fix round ${fixAttempts}`;
    phase('Fix');
    const fix = await agent(fixPrompt(vetted.confirmed, fixAttempts, fixHistory, prevKeys), {
      agentType: AGENTS.builder,
      label: `fix:${issue}#${fixAttempts}`,
      schema: BUILD_SCHEMA,
      ...iso,
    });
    fixHistory.push({ round: fixAttempts, summary: fix && fix.summary ? fix.summary : 'n/a', report: fix && fix.report ? fix.report : '' });
    prevKeys = new Set(vetted.confirmed.map(findingKey));
    abortStage = 'verify';
    ({ review, qa, qaWeb } = await verify());
    abortStage = 'vet';
    vetted = await vetFindings(blockingFrom(review, qa, qaWeb));
  }
} catch (e) {
  abortError = e;
  log(`Run aborted at ${abortStage}: ${e && e.message ? e.message : e}. Posting the run report anyway`);
}

const outstanding = vetted.confirmed;

try {
  phase('Report');
  const finalComment = buildFinalComment();
  const reportPrompt = `Post the pipeline run report below as a NEW comment on the pull request ${build.prUrl}. Do NOT edit the PR body, the PR title or any existing comment: this is an additional, standalone comment. Write everything between the <<<REPORT and REPORT>>> markers (excluding the markers) VERBATIM (no edits, no summarising, no extra text) to a temp file, then run \`gh pr comment ${build.prUrl} --body-file <that-file>\`.

<<<REPORT
${finalComment}
REPORT>>>`;
  await agent(reportPrompt, { agentType: 'general-purpose', label: `report:${issue}`, effort: 'low' });
} catch (e) {
  log(`Run report step failed (non-blocking): ${e && e.message ? e.message : e}`);
}

const visualPrompt = (prNumber, plan) => `Publish the VISUAL SUMMARY for the pull request ${build.prUrl} (issue #${issue} of ${projectName}): the screenshots device QA captured, so the change can be judged from the PR alone. Everything here is best-effort: if a step fails, do as much as still makes sense, report what failed in \`note\`, and stop; never retry in a loop.

Hard boundaries: do NOT edit the PR body or title · do NOT edit or delete any comment other than the one carrying the marker below · do NOT commit anything to \`feature/${issue}\` and do NOT switch the current working tree to another branch · do NOT bypass git hooks.

0. RESOLVE the repository and yourself once: \`repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)\` and \`me=$(gh api user --jq .login)\`.

Capture plan: publish exactly these units, in this order. \`source\` is the PNG on disk, \`name\` the file name to publish it under (without extension):
\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\`

1. CONVERT: in a scratch directory, for every image of the plan, FIRST prove the source is a PNG that THIS repository's QA wrote for this issue:
   \`\`\`bash
   check_source() {
     src=$1
     dir=$(cd "$(dirname "$src")" 2>/dev/null && pwd -P) || return 1
     top=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null) || return 1
     top=$(cd "$top" && pwd -P) || return 1
     [ "$dir" = "$top/coverage/qa/${issue}" ] || return 1
     git -C "$top" remote get-url origin 2>/dev/null | grep -Eq "github\\.com[:/]$repo(\\.git)?/?$" || return 1
     [ -f "$src" ] && [ ! -L "$src" ] || return 1
     [ "$(head -c 8 "$src" | od -An -tx1 | tr -d ' \\n')" = "89504e470d0a1a0a" ] || return 1
   }
   \`\`\`
   The directory must resolve to exactly \`<git top-level>/coverage/qa/${issue}\` of a checkout of this repository (so a lookalike folder is rejected), the file must be a regular file, and its first 8 bytes the PNG magic number. Do NOT hardcode a repository path instead of \`rev-parse\`: QA may have run in a temporary worktree. Drop, and note in \`note\`, every image that fails. Then handle what survived in TWO separate ffmpeg runs, a decode probe then the conversion, and never merge them:
   \`\`\`bash
   ffmpeg -v error -i "<source>" -f null -
   ffmpeg -y -i "<source>" -vf "scale='if(gt(iw,ih),min(1080,iw),-2)':'if(gt(iw,ih),-2,min(1080,ih))'" "<scratch>/<name>.webp"
   \`\`\`
   Branch on the probe's EXIT CODE:
   - ffmpeg ABSENT (exit 127): nothing looked at the bytes, so copy the source unchanged to \`<scratch>/<name>.png\`.
   - PROBE FAILED (any other non-zero exit): the bytes do not decode as an image. DROP that image, \`rm -f\` anything it left, note it. Never convert or copy it.
   - PROBE SUCCEEDED (exit 0): run the conversion. If it succeeds with a NON-EMPTY \`.webp\`, publish that. Otherwise \`rm -f "<scratch>/<name>.webp"\` UNCONDITIONALLY and copy the SOURCE unchanged to \`<scratch>/<name>.png\`, noting it (an ffmpeg without libwebp decodes PNGs and fails every WebP encode).
   Remember each file's ACTUAL extension for the markdown.
2. PUSH: publish those files on the per-PR evidence branch \`qa-evidence/pr-${prNumber}\`, branched fresh off the PR head each time so a re-run replaces the previous evidence:
   \`\`\`bash
   git fetch origin feature/${issue}
   git worktree add --detach "<scratch>/evidence" origin/feature/${issue}
   mkdir -p "<scratch>/evidence/qa"
   find "<scratch>" -maxdepth 1 -type f \\( -name '*.webp' -o -name '*.png' \\) -exec cp {} "<scratch>/evidence/qa/" \\;
   git -C "<scratch>/evidence" add qa
   git -C "<scratch>/evidence" commit -m "chore(${issue}): visual qa evidence for pull request ${prNumber}"
   git -C "<scratch>/evidence" push --force origin HEAD:refs/heads/qa-evidence/pr-${prNumber}
   git worktree remove --force "<scratch>/evidence"
   \`\`\`
   Use a detached worktree exactly like that (never \`git checkout\` in the main working tree) and always remove it at the end, including on failure. Collect files with \`find\` as written, NOT a \`cp *.webp *.png\` glob (in zsh a pattern that matches nothing aborts the command). If \`<scratch>/evidence/qa\` is empty, skip the commit and push, remove the worktree, and say so in \`note\`. The force push is ONLY ever to this evidence branch.
3. BUILD THE COMMENT: write EXACTLY this markdown to a file and nothing else:
   - First line: \`${VISUAL_MARKER}\`, the very first characters of the body (step 4 finds the comment by that PREFIX).
   - Then: \`## ${projectName} visual summary\`
   - Then, per plan unit IN PLAN ORDER: the caption line \`**<surface>: <caption>**\` with \`surface\` and \`caption\` verbatim from the plan, a blank line, then \`![<surface>: <caption>](<url>)\`.
   - Every url is \`https://raw.githubusercontent.com/$repo/qa-evidence/pr-${prNumber}/qa/<file name with its real extension>\`.
   - Skip any unit whose image failed to convert or push.
4. POST OR UPDATE exactly ONE comment, found by its marker:
   \`\`\`bash
   id=$(gh api "repos/$repo/issues/${prNumber}/comments" --paginate --jq "[.[] | select(.user.login == \\"$me\\") | select(.body | startswith(\\"${VISUAL_MARKER}\\"))] | .[0].id // empty" | head -n 1)
   if [ -n "$id" ]; then gh api -X PATCH "repos/$repo/issues/comments/$id" -F body=@<comment file>; else gh pr comment ${build.prUrl} --body-file <comment file>; fi
   \`\`\`
   Match with \`startswith\`, NEVER \`contains\`: the run report posted just before routinely quotes the marker, and \`contains\` would overwrite it. Never use \`gh pr comment --edit-last\`.
5. VERIFY: \`curl -sI <one published url>\` answers 200; say so in \`note\` if it does not.

Return \`published\` (how many images the comment links), \`commentAction\` (\`created\`, \`updated\` or \`failed\`) and a one-line \`note\`.`;

// NOTE: the visual summary runs strictly AFTER the run report, so the pixels sit below the verdict.
// An empty explorer proposal is an OFF switch enforced here, not only in the capture prompts: a QA
// lane that returns a manifest anyway must still not get an evidence branch and a comment.
const visualsOff = exploredVisualSubjects !== null && exploredVisualSubjects.length === 0;
const visualUnits = visualsOff ? [] : visualPlan(qa);
const prNumber = (String(build.prUrl).match(/\/pull\/(\d+)/) || [])[1] || null;

if (visualsOff) {
  log('Visual summary skipped: the explorer proposed no visual subject');
} else if (visualUnits.length === 0) {
  log('Visual summary skipped: no screenshots were captured for this run');
} else if (!prNumber) {
  log(`Visual summary skipped: no PR number in ${build.prUrl}`);
} else {
  try {
    phase('Visual summary');
    const visual = await agent(visualPrompt(prNumber, visualUnits), {
      agentType: 'general-purpose',
      label: `visual:${issue}`,
      effort: 'low',
      schema: VISUAL_SCHEMA,
    });
    if (visual) log(`Visual summary ${visual.commentAction}: ${visual.published} image(s). ${visual.note}`);
  } catch (e) {
    log(`Visual summary step failed (non-blocking): ${e && e.message ? e.message : e}`);
  }
}

if (abortError) throw abortError;

const ranMobileQa = doQa && qaTargets.includes('mobile');
const ranWebQa = doQa && qaTargets.includes('web');

return {
  prUrl: build.prUrl,
  explored: Boolean(explorerReport),
  reviewVerdict: doReview ? review.verdict : 'skipped',
  qaVerdict: ranMobileQa ? qaVerdictFrom(qa) : 'skipped',
  qaItems: ranMobileQa && qa ? qa.items : [],
  qaWebVerdict: ranWebQa ? qaVerdictFrom(qaWeb) : 'skipped',
  qaWebItems: ranWebQa && qaWeb ? qaWeb.items : [],
  fixAttempts,
  stuck,
  passed: outstanding.length === 0 && vetted.suspect.length === 0,
  outstanding,
  suspects: vetted.suspect,
  refuted: vetted.refuted,
};
