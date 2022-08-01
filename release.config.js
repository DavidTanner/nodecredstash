module.exports = {
  branches: [
    'master',
    { name: 'alpha', prerelease: true },
  ],
  plugins: [
    ['@semantic-release/commit-analyzer', { preset: 'conventionalcommits' }],
    ['@semantic-release/npm'],
    ['@semantic-release/github'],
  ],
};
