module.exports = {
  extends: 'airbnb-base',
  rules: {
    'func-names': 'off',

    'prefer-object-spread': 'off',
    'import/no-extraneous-dependencies': 'off',
    'class-methods-use-this': 'off',
    'no-await-in-loop': 'off',
    eqeqeq: 'off',
    'no-restricted-syntax': 'off',
  },
  env: {
    jest: true,
  },
};
