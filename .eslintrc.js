module.exports = {
  extends: 'airbnb-base',
  plugins: [
    'chai-expect',
  ],
  rules: {
    'func-names': 'off',

    'prefer-object-spread': 'off',
    'react/require-extension': 'off',
    'import/no-extraneous-dependencies': 'off',
    'class-methods-use-this': 'off',
    'no-await-in-loop': 'off',
    eqeqeq: 'off',
  },
  env: {
    jest: true,
  },
};
