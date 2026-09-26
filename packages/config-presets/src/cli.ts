#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runDepsCheck } from './checks/deps.js';
import type { CheckResult } from './checks/files.js';
import { checkHooks } from './checks/hooks.js';
import { checkI18n, checkUnusedKeys } from './checks/i18n.js';
import { checkText } from './checks/text.js';
import { init } from './init/init.js';
import { findKitConfig, KitConfigError, loadKitConfig } from './kitConfig.js';

const USAGE = `Usage: config-presets <command> [options]

  init                 write kit.config.json and the kit's configs into the app, add the scripts
    --yes, -y          accept the defaults for every question no flag answers
    --force            overwrite files, kit.config.json and scripts the app already has
    --no-install       only write files: skip npm install, expo install, Biome and lefthook
    --project-name <name>   --features-root <features|src/features>   --app-root <dir>
    --i18n <catalog folder|none>   --languages <en,it>   --dashes <forbid|allow>
  check-text [files]   no em or en dash in any file (--message <file> for a commit message,
                       --fix to replace them with hyphens)
  check-i18n           catalog parity: keys, plural pairs, placeholders, copy outside the catalog
  check-unused-keys    every catalog key is read somewhere
  check-hooks          no hook or memoised component holding a stale language
  check-deps           dependency-cruiser architecture rules (--config <file>)
`;

const out = (line: string) => process.stdout.write(`${line}\n`);
const err = (line: string) => process.stderr.write(`${line}\n`);

/** The package folder: `dist/cli.js` sits one level below it. */
const packageRoot = () => dirname(dirname(fileURLToPath(import.meta.url)));

function context() {
  const file = findKitConfig();
  if (!file) throw new KitConfigError(`No kit.config.json in ${process.cwd()} or above it. Run config-presets init.`);
  return { rootDir: dirname(file), config: loadKitConfig({ path: file }) };
}

function print(result: CheckResult): number {
  const lines = result.problems.slice(0, 50).map(problem => `  ${problem}`);
  if (result.problems.length > 50) lines.push(`  ... and ${result.problems.length - 50} more`);
  (result.ok ? out : err)([result.summary, ...lines].join('\n'));
  return result.ok ? 0 : 1;
}

async function ask(question: string, fallback: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(`${question} [${fallback}]: `);
  } finally {
    rl.close();
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case 'init': {
      const { values } = parseArgs({
        args: [...rest],
        options: {
          yes: { type: 'boolean', short: 'y', default: false },
          force: { type: 'boolean', default: false },
          install: { type: 'boolean', default: true },
          'project-name': { type: 'string' },
          'features-root': { type: 'string' },
          'app-root': { type: 'string' },
          i18n: { type: 'string' },
          languages: { type: 'string' },
          dashes: { type: 'string' },
        },
        allowNegative: true,
      });
      return init({
        cwd: process.cwd(),
        packageRoot: packageRoot(),
        yes: values.yes,
        force: values.force,
        install: values.install,
        flags: {
          ...(values['project-name'] !== undefined ? { projectName: values['project-name'] } : {}),
          ...(values['features-root'] !== undefined ? { featuresRoot: values['features-root'] } : {}),
          ...(values['app-root'] !== undefined ? { appRoot: values['app-root'] } : {}),
          ...(values.i18n !== undefined ? { i18n: values.i18n } : {}),
          ...(values.languages !== undefined ? { languages: values.languages.split(',') } : {}),
          ...(values.dashes !== undefined ? { dashes: values.dashes } : {}),
        },
        ...(process.stdin.isTTY ? { ask } : {}),
        write: out,
      });
    }
    case 'check-text': {
      const { values, positionals } = parseArgs({
        args: [...rest],
        options: { message: { type: 'string' }, fix: { type: 'boolean', default: false } },
        allowPositionals: true,
      });
      const { rootDir, config } = context();
      if (values.message !== undefined) {
        return print(checkText({ rootDir, config, message: readFileSync(values.message, 'utf8') }));
      }
      return print(
        checkText({ rootDir, config, fix: values.fix, ...(positionals.length > 0 ? { files: positionals } : {}) }),
      );
    }
    case 'check-i18n':
      return print(await checkI18n(context()));
    case 'check-unused-keys':
      return print(await checkUnusedKeys(context()));
    case 'check-hooks':
      return print(checkHooks(context()));
    case 'check-deps': {
      const { values } = parseArgs({ args: [...rest], options: { config: { type: 'string' } } });
      return runDepsCheck({ ...context(), ...(values.config !== undefined ? { configFile: values.config } : {}) }, out);
    }
    case undefined:
    case '--help':
    case '-h':
      out(USAGE);
      return command === undefined ? 1 : 0;
    default:
      err(`Unknown command "${command}".\n\n${USAGE}`);
      return 1;
  }
}

main(process.argv.slice(2)).then(
  code => {
    process.exitCode = code;
  },
  (error: unknown) => {
    err(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  },
);
