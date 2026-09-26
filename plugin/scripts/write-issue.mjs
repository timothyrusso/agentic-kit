#!/usr/bin/env node
/**
 * Creates a Feature issue and puts it on the app's board, with every id taken from
 * `kit.config.json`. Used by the `write-issue` skill once the body is approved.
 *
 *   node write-issue.mjs --title "<title>" --body-file <file> [--dry-run]
 *
 * `--dry-run` prints the title, labels, body and board it would use, and the exact `gh` commands,
 * without calling `gh`. A real run prints one JSON line: `{ issueUrl, addedToBoard, statusSet,
 * problems }`. The board owner is the owner of the `origin` remote.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readKitConfig } from './kit-config.mjs';

/** Title prefix of the Feature issue template. */
export const TITLE_PREFIX = '[Feature]: ';

/** Label of the Feature issue template, applied only when `github.labels` allows it. */
export const FEATURE_LABEL = 'enhancement';

/** Headings the agents parse; an issue without them cannot go through the pipeline. */
export const REQUIRED_HEADINGS = ['### Description', '### Acceptance criteria'];

/**
 * Parses the command line.
 * @param {string[]} argv
 * @returns {{ title?: string, bodyFile?: string, dryRun: boolean }}
 */
export function parseArgs(argv) {
  const options = { title: undefined, bodyFile: undefined, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--title') options.title = argv[++i];
    else if (arg === '--body-file') options.bodyFile = argv[++i];
    else throw new Error(`unexpected argument "${arg}"`);
  }
  return options;
}

/**
 * The `owner` of a GitHub remote URL (`git@github.com:owner/repo.git` or `https://github.com/owner/repo`).
 * @param {string} url
 * @returns {string | null}
 */
export function ownerFromRemote(url) {
  const match = url.trim().match(/github\.com[:/]([^/]+)\/[^/]+?(?:\.git)?\/?$/);
  return match ? match[1] : null;
}

/**
 * Everything the skill will do, derived from the config and the approved draft.
 * @param {Record<string, any>} config the parsed `kit.config.json`
 * @param {{ title: string, body: string, owner: string | null }} draft
 */
export function planIssue(config, draft) {
  const problems = REQUIRED_HEADINGS.filter(
    heading => !draft.body.split('\n').some(line => line.trim() === heading),
  ).map(heading => `the body has no "${heading}" heading`);
  const bare = draft.title.trim().replace(/^\[Feature\]:\s*/, '');
  if (!bare) problems.push('the title is empty');
  const title = `${TITLE_PREFIX}${bare}`;
  const github = config.github;
  const labels = Array.isArray(github?.labels) && github.labels.includes(FEATURE_LABEL) ? [FEATURE_LABEL] : [];
  const board = github
    ? {
        projectNumber: github.projectNumber,
        owner: draft.owner,
        projectId: github.projectId,
        statusFieldId: github.statusFieldId,
        statusOptionId: github.statusOptions.todo,
      }
    : null;
  if (board && !board.owner) problems.push('the board owner could not be read from the origin remote');
  const create = ['issue', 'create', '--title', title, '--body-file', '<body file>'];
  for (const label of labels) create.push('--label', label);
  const commands = [['gh', ...create]];
  if (board) {
    commands.push(
      [
        'gh',
        'project',
        'item-add',
        String(board.projectNumber),
        '--owner',
        String(board.owner),
        '--url',
        '<issue url>',
      ],
      [
        'gh',
        'project',
        'item-edit',
        '--id',
        '<item id>',
        '--project-id',
        board.projectId,
        '--field-id',
        board.statusFieldId,
        '--single-select-option-id',
        board.statusOptionId,
      ],
    );
  }
  return { projectName: config.projectName, title, labels, body: draft.body, board, commands, problems };
}

/**
 * Quotes one shell word for display.
 * @param {string} word
 */
function shellWord(word) {
  return /^[\w@%+=:,./<>-]+$/.test(word) && !/[<>]/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`;
}

/**
 * The human-readable dry run.
 * @param {ReturnType<typeof planIssue>} plan
 */
export function formatDryRun(plan) {
  const lines = [
    `write-issue --dry-run for ${plan.projectName} (nothing was created)`,
    '',
    `Title:  ${plan.title}`,
    `Labels: ${plan.labels.length > 0 ? plan.labels.join(', ') : '(none: "enhancement" is not in github.labels)'}`,
  ];
  if (plan.board) {
    lines.push(
      `Board:  project ${plan.board.projectNumber} of ${plan.board.owner ?? '(unknown owner)'}, id ${plan.board.projectId}`,
      `Status: field ${plan.board.statusFieldId}, option ${plan.board.statusOptionId} (github.statusOptions.todo)`,
    );
  } else {
    lines.push('Board:  (none: kit.config.json has no github section, the issue would not be added to a board)');
  }
  lines.push('', 'Commands:', ...plan.commands.map(command => `  ${command.map(shellWord).join(' ')}`));
  if (plan.problems.length > 0) lines.push('', 'Problems:', ...plan.problems.map(problem => `  - ${problem}`));
  lines.push('', 'Body:', '', plan.body.trimEnd());
  return `${lines.join('\n')}\n`;
}

/**
 * Runs the plan with `gh`. The issue stands even when the board calls fail.
 * @param {ReturnType<typeof planIssue>} plan
 * @param {string} bodyFile
 * @param {(args: string[]) => string} gh runs `gh` and returns its trimmed stdout
 */
export function createIssue(plan, bodyFile, gh) {
  const create = plan.commands[0].slice(1).map(word => (word === '<body file>' ? bodyFile : word));
  const issueUrl = gh(create).split('\n').pop() ?? '';
  const result = { issueUrl, addedToBoard: false, statusSet: false, problems: [] };
  if (!plan.board) {
    result.problems.push('kit.config.json has no github section: the issue is on no board');
    return result;
  }
  let itemId = '';
  try {
    itemId = gh([
      'project',
      'item-add',
      String(plan.board.projectNumber),
      '--owner',
      String(plan.board.owner),
      '--url',
      issueUrl,
      '--format',
      'json',
      '--jq',
      '.id',
    ]);
    result.addedToBoard = itemId.length > 0;
  } catch (error) {
    result.problems.push(`gh project item-add failed (try \`gh auth refresh -s project\`): ${messageOf(error)}`);
    return result;
  }
  try {
    gh([
      'project',
      'item-edit',
      '--id',
      itemId,
      '--project-id',
      plan.board.projectId,
      '--field-id',
      plan.board.statusFieldId,
      '--single-select-option-id',
      plan.board.statusOptionId,
    ]);
    result.statusSet = true;
  } catch (error) {
    result.problems.push(`gh project item-edit failed (try \`gh auth refresh -s project\`): ${messageOf(error)}`);
  }
  return result;
}

/** @param {unknown} error */
function messageOf(error) {
  const stderr = typeof error === 'object' && error !== null && 'stderr' in error ? String(error.stderr).trim() : '';
  if (stderr) return stderr.split('\n')[0];
  return error instanceof Error ? error.message.split('\n')[0] : String(error);
}

function originOwner() {
  try {
    return ownerFromRemote(execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }));
  } catch {
    return null;
  }
}

function main(argv) {
  const options = parseArgs(argv);
  if (!options.title || !options.bodyFile) {
    throw new Error('usage: write-issue.mjs --title "<title>" --body-file <file> [--dry-run]');
  }
  const { config } = readKitConfig();
  const body = readFileSync(options.bodyFile, 'utf8');
  const plan = planIssue(config, { title: options.title, body, owner: originOwner() });
  if (options.dryRun) {
    process.stdout.write(formatDryRun(plan));
    return plan.problems.length > 0 ? 1 : 0;
  }
  if (plan.problems.length > 0) throw new Error(`not creating the issue:\n  - ${plan.problems.join('\n  - ')}`);
  const gh = args => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  process.stdout.write(`${JSON.stringify(createIssue(plan, options.bodyFile, gh))}\n`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`write-issue: ${messageOf(error)}\n`);
    process.exitCode = 1;
  }
}
