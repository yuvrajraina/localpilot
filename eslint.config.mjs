import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['out/**', 'dist/**', 'build/**', 'node_modules/**', '.vscode-test/**', '*.vsix']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        suite: 'readonly',
        test: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-import-type-side-effects': 'error'
    }
  }
];
