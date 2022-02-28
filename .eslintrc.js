module.exports = {
  extends: ['@ikscodes/eslint-config'],

  parserOptions: {
    project: ['./tsconfig.json'],
  },

  settings: {
    'import/resolver': {
      typescript: {
        project: ['./tsconfig.json'],
      },
    },
  },

  rules: {
    // Core ESLint rules
    'no-alert': 0,
    'no-empty': 0,
    'dot-notation': 0,
    'default-case': 0,
    'no-cond-assign': 0,
    'prefer-template': 0,
    'no-return-assign': 0,
    'no-useless-return': 0,
    'consistent-return': 0,
    'no-underscore-dangle': 0,
    'no-useless-constructor': 0,
    'class-methods-use-this': 0,
    'no-param-reassign': [2, { props: false }],

    // React rules
    'react/prop-types': 0,
    'react/button-has-type': 0,
    'react/state-in-constructor': 0,
    'react/jsx-filename-extension': 0,
    'react/prefer-stateless-function': 0,
    'react/require-default-props': 0,
    'react/no-unused-prop-types': 0,

    // TypeScript rules
    '@typescript-eslint/ban-types': 0,
    '@typescript-eslint/ban-ts-comment': 0,
    '@typescript-eslint/await-thenable': 0,
    '@typescript-eslint/no-unsafe-call': 0,
    '@typescript-eslint/no-var-requires': 0,
    '@typescript-eslint/no-unsafe-return': 0,
    '@typescript-eslint/no-empty-function': 0,
    '@typescript-eslint/no-unsafe-argument': 0,
    '@typescript-eslint/no-unsafe-assignment': 0,
    '@typescript-eslint/no-floating-promises': 0,
    '@typescript-eslint/restrict-plus-operands': 0,
    '@typescript-eslint/no-unsafe-member-access': 0,
    '@typescript-eslint/no-unnecessary-type-assertion': 0,
    '@typescript-eslint/restrict-template-expressions': 0,
    '@typescript-eslint/explicit-module-boundary-types': 0,
    '@typescript-eslint/no-non-null-asserted-optional-chain': 0,

    // Import rules
    'import/extensions': 0,
    'import/no-extraneous-dependencies': [1, { devDependencies: true }],
    'import/prefer-default-export': 0,
    'import/no-unresolved': 0,
  },
};
