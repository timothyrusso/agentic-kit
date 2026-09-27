/**
 * Commit messages are `type(issue): message`, e.g. `feat(12): add the settings screen`: the scope
 * is always the GitHub issue number. Extend it from the app's `commitlint.config.cjs`:
 *
 *   module.exports = { extends: ['@timothyrusso/config-presets/commitlint'] };
 */
const config = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'scope-issue-number': ({ scope }) => [
          /^\d+$/.test(scope ?? ''),
          'scope must be the GitHub issue number, e.g. feat(12): add the settings screen',
        ],
      },
    },
  ],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'ci', 'perf', 'build']],
    'scope-empty': [2, 'never'],
    'subject-case': [0],
    'scope-issue-number': [2, 'always'],
  },
};

module.exports = config;
