import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'src/generated/**', '.adminjs/**', 'coverage/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['src/*/{controller,service,validation}.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'TSInterfaceDeclaration', message: 'Declare feature interfaces in types.ts.' },
        {
          selector: 'TSTypeAliasDeclaration',
          message: 'Declare feature type aliases in types.ts.',
        },
      ],
    },
  },
  {
    files: ['src/*/types.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'VariableDeclaration, FunctionDeclaration, ClassDeclaration, TSEnumDeclaration',
          message: 'Keep types.ts free of runtime declarations.',
        },
        {
          selector: "ImportDeclaration[importKind!='type']",
          message: 'Use import type in types.ts.',
        },
      ],
    },
  },
  {
    files: ['src/*/validation.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\./(?:types|errors)\\.js$)',
              message:
                'Validators may import only feature types and domain errors. Keep HTTP and database dependencies in controllers and services.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/*/controller.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/*', 'prisma', 'pg', '**/db.js'],
              message: 'Access the database through the feature service.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/*/errors.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "ClassDeclaration:not([superClass.name='ValidationError'])",
          message: 'Feature validation errors must extend the shared ValidationError.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.\\./validation-error\\.js$)',
              message: 'Feature validation errors depend only on the shared ValidationError.',
            },
          ],
        },
      ],
    },
  },
  { files: ['src/**/*.ts'], rules: { 'no-console': 'error' } },
  prettier,
);
