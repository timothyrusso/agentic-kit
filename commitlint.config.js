/**
 * Commit messages are `type(issue): message`, e.g. `feat(4): add tier rule generator`.
 * The scope is always the GitHub issue number, and no co-author trailer is allowed.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'scope-issue-number': ({ scope }) => [
          /^\d+$/.test(scope ?? ''),
          'scope must be the GitHub issue number, e.g. feat(4): add tier rule generator',
        ],
        'no-co-author': ({ raw }) => [!/^co-authored-by:/im.test(raw ?? ''), 'remove the Co-Authored-By trailer'],
      },
    },
  ],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'ci', 'perf', 'build']],
    'scope-empty': [2, 'never'],
    'subject-case': [0],
    'scope-issue-number': [2, 'always'],
    'no-co-author': [2, 'always'],
  },
};
