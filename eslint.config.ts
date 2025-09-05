import path from 'node:path';

import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import { configs, plugins } from 'eslint-config-airbnb-extended';
import { type Linter } from 'eslint';

const gitignorePath = path.resolve('.', '.gitignore');

const jsConfig = [
  // ESLint Recommended Rules
  {
    name: 'js/config',
    ...js.configs.recommended,
  },
  // Stylistic Plugin
  plugins.stylistic,
  // Typescript Plugin
  plugins.typescriptEslint,
  // Import X Plugin
  plugins.importX,
  // Airbnb Base Recommended Config
  ...configs.base.recommended,
];

const nodeConfig = [
  // Node Plugin
  plugins.node,
  // Airbnb Node Recommended Config
  ...configs.node.recommended,
];

const typescriptConfig = [
  // TypeScript ESLint Plugin
  plugins.typescriptEslint,
  // Airbnb Base TypeScript Config
  ...configs.base.typescript,
];

// Equivalent to airbnb-base
const config: Linter.Config[] = [
  // Ignore .gitignore files/folder in eslint
  includeIgnoreFile(gitignorePath),
  // Javascript Config
  ...jsConfig,
  // Node Config
  ...nodeConfig,
  // TypeScript Config
  ...typescriptConfig,
  {
    rules: {
      'func-names': 'off',
      'prefer-object-spread': 'off',
      'import-x/prefer-default-export': 'off',
      'import-x/extensions': 'off',
      'import-x/no-unresolved': 'off',
      'import-x/no-extraneous-dependencies': 'off',
      'class-methods-use-this': 'off',
      'no-await-in-loop': 'off',
      eqeqeq: 'off',
      'no-restricted-syntax': 'off',
      '@stylistic/max-len': ['error', { code: 200 }],
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      // BEGIN ERRORS
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true, allowNullish: true },
      ],
      '@typescript-eslint/restrict-plus-operands': [
        'error',
        { skipCompoundAssignments: true },
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
      '@typescript-eslint/no-redundant-type-constituents': 'off',
    },
  },
  {
    files: [
      'test/**/*.{ts,tsx}',
      '*.test.{ts,tsx}',
    ],
    rules: {
      // Allow ! in tests.
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Allow tests to create odd string templates if they want.
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
];

export default config;
