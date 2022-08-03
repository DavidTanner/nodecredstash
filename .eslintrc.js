module.exports = {
  extends: 'airbnb-base',
  rules: {
    'func-names': 'off',

    'prefer-object-spread': 'off',
    'import/prefer-default-export': 'off',
    'import/extensions': 'off',
    'import/no-unresolved': 'off',
    'import/no-extraneous-dependencies': 'off',
    'class-methods-use-this': 'off',
    'no-await-in-loop': 'off',
    eqeqeq: 'off',
    'no-restricted-syntax': 'off',
    'max-len': ['error', { code: 120 }],
  },
  env: {
    node: true,
  },
  overrides: [
    {
      files: [
        '*.{ts,tsx}',
      ],
      plugins: [
        '@typescript-eslint',
      ],
      extends: [
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2020,
        tsconfigRootDir: '.',
      },
      rules: {
        'import/prefer-default-export': 'off',

        // BEGIN ERRORS
        '@typescript-eslint/no-non-null-assertion': 'error',
        '@typescript-eslint/no-require-imports': 'error',
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/restrict-template-expressions': [
          'error',
          { allowNumber: true, allowBoolean: true, allowUndefined: true },
        ],
        '@typescript-eslint/restrict-plus-operands': [
          'error',
          { checkCompoundAssignments: true },
        ],

        // This prevents declarations like `interface ISomething { ... }`
        '@typescript-eslint/naming-convention': [
          'error',
          {
            selector: 'interface',
            format: ['PascalCase'],
            custom: {
              regex: '^I[A-Z]',
              match: false,
            },
          },
        ],

        // BEGIN DISABLED. Some of these are disabled just to prevent warnings.
        '@typescript-eslint/explicit-member-accessibility': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-empty-function': 'off',
      },
    },
    {
      files: [
        'test/**/*.{ts,tsx}',
        '*.test.{ts,tsx}',
      ],
      plugins: [
        '@typescript-eslint',
      ],
      rules: {
        // Allow ! in tests.
        '@typescript-eslint/no-non-null-assertion': 'off',

        // Allow tests to create odd string templates if they want.
        '@typescript-eslint/restrict-template-expressions': 'off',
      },
    },
    {
      files: [
        'jest.*.js',
        'test/**/*.{ts,tsx,js,jsx}',
        '*.test.{ts,tsx,js,jsx}',
        '__mocks__/**/*.{ts,tsx,js,jsx}',
      ],
      plugins: [
        'jest',
      ],
      extends: [
        'plugin:jest/recommended',
      ],
      env: {
        node: true,
        jest: true,
        'jest/globals': true,
      },
      rules: {
        'jest/expect-expect': 'off',
        'jest/no-test-callback': 'off',

        // This rule will often flag test utilities.
        'jest/no-export': 'off',

        // We often need to conditionally call expect(...) in test helpers
        'jest/no-conditional-expect': 'off',

        // The jest recommended config sets this rule to 'warn', so just turn it off
        'jest/no-commented-out-tests': 'off',
      },
    },
  ],
};
