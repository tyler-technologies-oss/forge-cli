import { defineConfig } from 'eslint/config';
import tylerPlugin from '@tylertech-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';

export default defineConfig([
  {
    files: ['**/*.ts'],
    extends: [tylerPlugin.configs.tsStrict, tylerPlugin.configs.tsStylistic],
    plugins: {
      import: importPlugin
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-useless-escape': 'off',
      'no-async-promise-executor': 'off',
      'import/extensions': ['error', 'ignorePackages']
    }
  },
  {
    ignores: [
      'dist/**/*',
      'templates/**/*',
      'bin/**/*',
      'config/**/*',
      'test/**/*'
    ]
  }
]);
